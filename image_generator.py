# image_generator.py
import torch
import gc
import os
import tempfile
import traceback
from diffusers.schedulers.scheduling_dpmsolver_multistep import DPMSolverMultistepScheduler
from diffusers.pipelines.stable_diffusion.pipeline_stable_diffusion import StableDiffusionPipeline
from transformers import CLIPTextModel, CLIPTokenizer
from compel import Compel
from transformers import logging as transformers_logging
from config import (
    MODEL_PATH, IMAGE_GEN_TIMEOUT, TEMP_IMAGE_DIR, IMAGE_BASE_PROMPT,
    IMAGE_NEGATIVE_PROMPT, IMAGE_INFERENCE_STEPS, IMAGE_GUIDANCE_SCALE
)

# Mute the 77-token warning without breaking the tokenizer
transformers_logging.set_verbosity_error()

os.makedirs(TEMP_IMAGE_DIR, exist_ok=True)

# OPTIMIZED FOR TOKENS: Shrunk from 45 tokens to ~20 highly-weighted tags
# Hardcode her exact physical identity here so the LLM doesn't have to remember it
BASE_PROMPT = IMAGE_BASE_PROMPT

# Removed "face, head, eyes, portrait, cropped" so the AI is allowed to draw her face and take close-ups
NEGATIVE_PROMPT = IMAGE_NEGATIVE_PROMPT

def generate_selfie(user_description: str):
    print("\n[VRAM SWAP] Unloading LLM and mapping Image Gen to GPU...")
    torch.cuda.empty_cache()
    gc.collect()

    pipe = None  

    try:
        # Read model path from config/environment variable or use default
        local_model_path = MODEL_PATH
        
        # Normalize and expand path
        local_model_path = os.path.abspath(os.path.expanduser(local_model_path))
        
        if not os.path.exists(local_model_path):
            raise FileNotFoundError(
                f"Model file not found at {local_model_path}. "
                f"Set MODEL_PATH environment variable or place model file at the default location."
            )
        
        print("[IMAGE GEN] Loading official CLIP Text Encoder fallback...")
        text_encoder = CLIPTextModel.from_pretrained(
            "runwayml/stable-diffusion-v1-5", 
            subfolder="text_encoder", 
            torch_dtype=torch.float16
        )
        tokenizer = CLIPTokenizer.from_pretrained(
            "runwayml/stable-diffusion-v1-5", 
            subfolder="tokenizer"
        )
        
        pipe = StableDiffusionPipeline.from_single_file(
            local_model_path, 
            text_encoder=text_encoder,
            tokenizer=tokenizer,
            torch_dtype=torch.float16, 
            safety_checker=None
        )
        
        # CRISP HIGH-QUALITY SCHEDULER: Swapped back to DPM++ Multistep for standard checkpoints
        pipe.scheduler = DPMSolverMultistepScheduler.from_config(
            pipe.scheduler.config
        )
        
        pipe.to("cuda")

        print("[IMAGE GEN] Compiling embeddings to bypass token limits...")
        compel_proc = Compel(
            tokenizer=pipe.tokenizer, 
            text_encoder=pipe.text_encoder,
            truncate_long_prompts=False # Tells it to stitch chunks together instead of cutting them!
        )

        final_prompt = f"{user_description}, {BASE_PROMPT}"
        print(f"[IMAGE GEN] Generating crisp asset: {user_description}")

        # 1. Convert text to infinite-length embeddings
        prompt_embeds = compel_proc(final_prompt)
        negative_embeds = compel_proc(NEGATIVE_PROMPT)
        
        [prompt_embeds, negative_embeds] = compel_proc.pad_conditioning_tensors_to_same_length(
            [prompt_embeds, negative_embeds]
        )
        
        # 3. Run high-fidelity inference pass (steps and guidance from config)
        image = pipe(
            prompt_embeds=prompt_embeds,
            negative_prompt_embeds=negative_embeds,
            num_inference_steps=IMAGE_INFERENCE_STEPS,
            guidance_scale=IMAGE_GUIDANCE_SCALE,
        ).images[0]

        filename = f"selfie_{os.urandom(6).hex()}.jpg"
        filepath = os.path.join(TEMP_IMAGE_DIR, filename)
        image.save(filepath)

        return filepath

    except Exception as e:
        print("\n[ERROR] The Image Generation pipeline crashed. Here is the REAL error:")
        traceback.print_exc() 
        return None

    finally:
        print("[VRAM SWAP] Wiping Image Gen from GPU. Restoring LLM...")
        if pipe is not None:
            del pipe
            
        if 'text_encoder' in locals():
            del text_encoder

        if 'compel_proc' in locals():
            del compel_proc
            
        torch.cuda.empty_cache()
        gc.collect()