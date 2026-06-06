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

_pipe = None
_text_encoder = None
_tokenizer = None
_compel_proc = None

# OPTIMIZED FOR TOKENS: Shrunk from 45 tokens to ~20 highly-weighted tags
# Hardcode her exact physical identity here so the LLM doesn't have to remember it
BASE_PROMPT = IMAGE_BASE_PROMPT

# Removed "face, head, eyes, portrait, cropped" so the AI is allowed to draw her face and take close-ups
NEGATIVE_PROMPT = IMAGE_NEGATIVE_PROMPT

def _load_image_assets():
    global _pipe, _text_encoder, _tokenizer, _compel_proc

    if _pipe is not None and _compel_proc is not None:
        return _pipe, _compel_proc

    local_model_path = os.path.abspath(os.path.expanduser(MODEL_PATH))
    if not os.path.exists(local_model_path):
        raise FileNotFoundError(
            f"Model file not found at {local_model_path}. "
            f"Set MODEL_PATH environment variable or place model file at the default location."
        )

    print("[IMAGE GEN] Loading official CLIP Text Encoder fallback...")
    _text_encoder = CLIPTextModel.from_pretrained(
        "runwayml/stable-diffusion-v1-5",
        subfolder="text_encoder",
        torch_dtype=torch.float16,
    )
    _tokenizer = CLIPTokenizer.from_pretrained(
        "runwayml/stable-diffusion-v1-5",
        subfolder="tokenizer",
    )

    _pipe = StableDiffusionPipeline.from_single_file(
        local_model_path,
        text_encoder=_text_encoder,
        tokenizer=_tokenizer,
        torch_dtype=torch.float16,
        safety_checker=None,
    )
    _pipe.scheduler = DPMSolverMultistepScheduler.from_config(_pipe.scheduler.config)
    _pipe.to("cuda")

    _compel_proc = Compel(
        tokenizer=_pipe.tokenizer,
        text_encoder=_pipe.text_encoder,
        truncate_long_prompts=False,
    )

    return _pipe, _compel_proc


def enhance_image_prompt(user_description: str, original_user_input: str) -> str:
    """Dynamically enhance the Stable Diffusion prompt with context-aware aesthetic tags."""
    explicit_keywords = [
        "lingerie", "bikini", "underwear", "bra", "panties", "cleavage", "bare", "nude",
        "naked", "topless", "boudoir", "bedroom", "bed", "shower", "wet", "nsfw", "sensual",
        "erotic", "lace", "sexy", "hot", "teasing", "nipples", "boobs", "pussy", "vagina", "penis"
    ]
    
    combined = f"{user_description} {original_user_input}".lower()
    is_explicit = any(word in combined for word in explicit_keywords)
    
    if is_explicit:
        # Intentionally inject premium explicit/sensual tags for mature roleplay contexts
        explicit_tags = (
            "sultry bedroom eyes, alluring posture, perfect curves, detailed skin texture, "
            "lace detailing, beautiful cleavage, (sensual, erotic:1.15), voluptuous body shape, bare shoulders"
        )
        enhanced = f"{user_description}, {explicit_tags}, {BASE_PROMPT}"
        print(f"[IMAGE GEN] Sensual context detected. Injected explicit enhancements.")
    else:
        # High-fidelity fashion enhancement tags for regular everyday/outdoor clothes
        fashion_tags = (
            "fashion photography, professional model pose, studio lighting, detailed garments, "
            "highly realistic fabric texture, sharp focus, aesthetic composition"
        )
        enhanced = f"{user_description}, {fashion_tags}, {BASE_PROMPT}"
        print(f"[IMAGE GEN] Casual context detected. Injected fashion photography tags.")
        
    return enhanced


def generate_selfie(user_description: str, original_user_input: str = ""):
    try:
        pipe, compel_proc = _load_image_assets()

        final_prompt = enhance_image_prompt(user_description, original_user_input)
        print(f"[IMAGE GEN] Generating crisp asset with prompt: {final_prompt[:140]}...")

        prompt_embeds = compel_proc(final_prompt)
        negative_embeds = compel_proc(NEGATIVE_PROMPT)
        [prompt_embeds, negative_embeds] = compel_proc.pad_conditioning_tensors_to_same_length(
            [prompt_embeds, negative_embeds]
        )

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

    except Exception:
        print("\n[ERROR] The Image Generation pipeline crashed. Here is the REAL error:")
        traceback.print_exc()
        return None

