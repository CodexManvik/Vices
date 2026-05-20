import json
import torch
from datasets import Dataset
from unsloth import FastLanguageModel, PatchDPOTrainer
from trl import DPOTrainer
from transformers import TrainingArguments
from config import (
    DPO_MODEL_NAME, DPO_MAX_SEQ_LENGTH, DPO_BATCH_SIZE, DPO_GRADIENT_ACCUMULATION_STEPS,
    DPO_NUM_EPOCHS, DPO_LEARNING_RATE, DPO_BETA, LORA_RANK, LORA_ALPHA, LORA_DROPOUT,
    OPTIMIZER_TYPE, WARMUP_RATIO, TRAINING_OUTPUT_DIR, LORA_OUTPUT_PATH, PREFERENCES_PATH,
    ENABLE_GRADIENT_CHECKPOINTING
)

# 1. Load the Model via Unsloth (Ultra-optimized for 4GB VRAM)
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = DPO_MODEL_NAME,
    max_seq_length = DPO_MAX_SEQ_LENGTH,
    dtype = None,
    load_in_4bit = True, # CRITICAL for 4GB VRAM
)

# 2. Add LoRA Adapters (We only train a small percentage of the model's weights to save VRAM)
model = FastLanguageModel.get_peft_model(
    model,
    r = LORA_RANK, 
    target_modules = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_alpha = LORA_ALPHA,
    lora_dropout = LORA_DROPOUT,
    bias = "none",
    use_gradient_checkpointing = "unsloth" if ENABLE_GRADIENT_CHECKPOINTING else False,
)

# 3. Load Your Local Dataset
def load_dpo_data():
    with open(PREFERENCES_PATH, "r", encoding="utf-8") as f:
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
        per_device_train_batch_size = DPO_BATCH_SIZE,
        gradient_accumulation_steps = DPO_GRADIENT_ACCUMULATION_STEPS,
        warmup_ratio = WARMUP_RATIO,
        num_train_epochs = DPO_NUM_EPOCHS,
        learning_rate = DPO_LEARNING_RATE,
        fp16 = not torch.cuda.is_bf16_supported(),
        bf16 = torch.cuda.is_bf16_supported(),
        logging_steps = 1,
        optim = OPTIMIZER_TYPE,
        output_dir = TRAINING_OUTPUT_DIR,
    ),
    beta = DPO_BETA,
)

# 5. Train and Export
print("Starting continuous learning loop (DPO)...")
trainer.train()

# 6. Save the new tuned LoRA adapter
model.save_pretrained(LORA_OUTPUT_PATH)
print("Training complete! New personality weights saved.")

# Note: Afterwards, you can use llama.cpp's export-lora tools to bake these 
# weights directly into your .gguf file!