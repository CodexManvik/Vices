# image_generator.py
import torch
import gc
import os
import tempfile
import traceback
from  diffusers.schedulers.scheduling_dpmsolver_multistep import DPMSolverMultistepScheduler
from diffusers.pipelines.stable_diffusion.pipeline_stable_diffusion import StableDiffusionPipeline
from transformers import CLIPTextModel, CLIPTokenizer
from compel import Compel
from transformers import logging as transformers_logging

# Mute the 77-token warning without breaking the tokenizer
transformers_logging.set_verbosity_error()

TEMP_IMAGE_DIR = os.path.join(tempfile.gettempdir(), "persona_ai_images")
os.makedirs(TEMP_IMAGE_DIR, exist_ok=True)

# OPTIMIZED FOR TOKENS: Shrunk from 45 tokens to ~20 highly-weighted tags
BASE_PROMPT = "masterpiece, best quality, 1girl, 18yo, slim fit, large breasts, nice ass, narrow waist, blonde brown hair, realistic skin texture"

# Removed "face, head, eyes, portrait, cropped" so the AI is allowed to draw her face and take close-ups
NEGATIVE_PROMPT = (
    "(deformed iris, deformed pupils, semi-realistic, cgi, 3d, render, sketch, cartoon, drawing, anime:1.4), "
    "text, worst quality, low quality, jpeg artifacts, ugly, duplicate, morbid, "
    "mutilated, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, blurry, "
    "bad anatomy, bad proportions, extra limbs, cloned face, disfigured, missing arms, missing legs, long neck"
)

def generate_selfie(user_description: str):
    print("\n[VRAM SWAP] Unloading LLM and mapping Image Gen to GPU...")
    torch.cuda.empty_cache()
    gc.collect()

    pipe = None  

    try:
        # PUT YOUR ACTUAL FILE PATH HERE
        local_model_path = r"C:\AI\models\realismByStableYogi_sd15V9.safetensors"
        
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
        
        # CRITICAL QUALITY FIX: Swap to DPM++ 2M Karras Scheduler
        pipe.scheduler = DPMSolverMultistepScheduler.from_config(
            pipe.scheduler.config, 
            use_karras_sigmas=True
        )
        
        pipe.to("cuda")

        print("[IMAGE GEN] Compiling embeddings to bypass token limits...")

        compel_proc = Compel(
            tokenizer=pipe.tokenizer, 
            text_encoder=pipe.text_encoder,
            truncate_long_prompts=False # This tells it to stitch chunks together instead of cutting them!
        )

        final_prompt = f"{user_description}, {BASE_PROMPT}"
        print(f"[IMAGE GEN] Generating: {user_description}")

        # 1. Convert text to infinite-length embeddings
        prompt_embeds = compel_proc(final_prompt)
        negative_embeds = compel_proc(NEGATIVE_PROMPT)
        
        # FIX: Added 's' to pad_conditioning_tensors_to_same_length
        [prompt_embeds, negative_embeds] = compel_proc.pad_conditioning_tensors_to_same_length(
            [prompt_embeds, negative_embeds]
        )
        
        # 3. Pass the EMBEDDINGS to the pipeline instead of the text
        image = pipe(
            prompt_embeds=prompt_embeds,
            negative_prompt_embeds=negative_embeds,
            num_inference_steps=27, 
            guidance_scale=7.0,     
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

        # Clean up compel processor
        if 'compel_proc' in locals():
            del compel_proc
            
        torch.cuda.empty_cache()
        gc.collect()