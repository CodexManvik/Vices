# state.py
from generation import get_available_models

# Dynamically fetch the running model from llama-server on boot
loaded_models = get_available_models()
initial_model = loaded_models[0]["id"] if loaded_models else "unknown-local-slot"

state = {
    "interaction_count": 0,
    "active_model": initial_model
}

def update_state(user_input):
    if not user_input or not user_input.strip():
        return
    state["interaction_count"] += 1

def set_active_model(model_name):
    state["active_model"] = model_name

def get_mood_description():
    return "sultry, highly personal, unfiltered, and effortlessly direct."