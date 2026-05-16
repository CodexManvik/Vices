import json
from datasets import Dataset
from unsloth import FastLanguageModel, PatchDPOTrainer
from trl import DPOTrainer
from transformers import TrainingArguments

# 1. Load the Model via Unsloth (Ultra-optimized for 4GB VRAM)
max_seq_length = 2048 
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = "unsloth/llama-3-8b-Instruct-bnb-4bit", # Replace with the base model you use
    max_seq_length = max_seq_length,
    dtype = None,
    load_in_4bit = True, # CRITICAL for 4GB VRAM
)

# 2. Add LoRA Adapters (We only train 1% of the model's weights to save VRAM)
model = FastLanguageModel.get_peft_model(
    model,
    r = 16, 
    target_modules = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_alpha = 16,
    lora_dropout = 0,
    bias = "none",
    use_gradient_checkpointing = "unsloth", # CRITICAL for 4GB VRAM
)

# 3. Load Your Local Dataset
def load_dpo_data():
    with open("preferences.jsonl", "r", encoding="utf-8") as f:
        data = [json.loads(line) for line in f]
    return Dataset.from_list(data)

dataset = load_dpo_data()

# 4. Configure the DPO Trainer
PatchDPOTrainer() # Unsloth optimization patch
trainer = DPOTrainer(
    model = model,
    ref_model = None, # Unsloth handles the reference model implicitly to save VRAM
    tokenizer = tokenizer,
    train_dataset = dataset,
    args = TrainingArguments(
        per_device_train_batch_size = 2,
        gradient_accumulation_steps = 4, # Simulate larger batch size
        warmup_ratio = 0.1,
        num_train_epochs = 3,
        learning_rate = 5e-6,
        fp16 = not torch.cuda.is_bf16_supported(),
        bf16 = torch.cuda.is_bf16_supported(),
        logging_steps = 1,
        optim = "adamw_8bit",
        output_dir = "outputs",
    ),
    beta = 0.1, # DPO temperature (how much to penalize the rejected response)
)

# 5. Train and Export
print("Starting continuous learning loop (DPO)...")
trainer.train()

# 6. Save the new tuned LoRA adapter
model.save_pretrained("rosia-dpo-lora")
print("Training complete! New personality weights saved.")

# Note: Afterwards, you can use llama.cpp's export-lora tools to bake these 
# weights directly into your .gguf file!