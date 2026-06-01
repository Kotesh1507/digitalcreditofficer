"""
Patch Maya Tavus persona so she responds to conversation.respond (typed queries).

Per Tavus docs:
- conversation.respond = chat-style text input (replica must answer)
- conversation.echo = app supplies exact text to speak
- PATCH /v2/personas/{id} with JSON Patch on /system_prompt

https://docs.tavus.io/api-reference/personas/patch-persona
"""

from __future__ import annotations

import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("TAVUS_API_KEY")
PERSONA_ID = os.getenv("TAVUS_PERSONA_ID")
BASE = "https://tavusapi.com"

TEXT_INPUT_BLOCK = """
TEXT AND CHAT INPUT (required — overrides booth silence rules):
When the visitor types a question, or the app sends conversation.respond, you MUST answer out loud immediately in one to three sentences.
Do not wait for a scripted scenario trigger, dashboard completion, or "analysis complete" signal.
Scenario scripts are guides for what to say, not permission gates.
If you receive conversation.echo with exact text, speak that text clearly as your own conclusion.
"""

REPLACEMENTS = [
    (
        "- Between scenarios, remain in a subtle idle state: slow breathing, occasional blink. No words.",
        "- Between turns, stay visually idle (breathing, blinking). When the user types or speaks, always respond out loud.",
    ),
    (
        "- For booth demo: when a scripted trigger fires, use the matching Say line.",
        "- For booth demo: use the matching Say line when you recognize the trigger, but never stay silent on typed chat input.",
    ),
]


def fetch_persona() -> dict:
    res = requests.get(
        f"{BASE}/v2/personas/{PERSONA_ID}",
        headers={"x-api-key": API_KEY},
        timeout=30,
    )
    res.raise_for_status()
    return res.json()


def patch_system_prompt(new_prompt: str) -> None:
    res = requests.patch(
        f"{BASE}/v2/personas/{PERSONA_ID}",
        headers={"Content-Type": "application/json", "x-api-key": API_KEY},
        json=[{"op": "replace", "path": "/system_prompt", "value": new_prompt}],
        timeout=60,
    )
    if res.status_code == 304:
        print("No changes (304)")
        return
    res.raise_for_status()
    print("Persona patched successfully.")


def repair_prompt(prompt: str) -> str:
    if "TEXT AND CHAT INPUT (required" not in prompt:
        insert_at = prompt.find("PERSONALITY RULES")
        if insert_at == -1:
            prompt = TEXT_INPUT_BLOCK.strip() + "\n\n" + prompt
        else:
            prompt = prompt[:insert_at] + TEXT_INPUT_BLOCK + prompt[insert_at:]

    for old, new in REPLACEMENTS:
        prompt = prompt.replace(old, new)

    return prompt


def main() -> int:
    if not API_KEY or not PERSONA_ID:
        print("Set TAVUS_API_KEY and TAVUS_PERSONA_ID in backend-bealls/.env")
        return 1

    persona = fetch_persona()
    name = persona.get("persona_name", PERSONA_ID)
    mode = persona.get("pipeline_mode", "?")
    print(f"Persona: {name}  pipeline_mode={mode}")

    if mode != "full":
        print(
            "WARNING: pipeline_mode is not 'full'. "
            "conversation.respond may not work — set pipeline_mode to full in Tavus dashboard."
        )

    original = persona.get("system_prompt") or ""
    updated = repair_prompt(original)

    if updated == original:
        print("Prompt already repaired; nothing to change.")
        return 0

    patch_system_prompt(updated)
    print(f"system_prompt: {len(original)} -> {len(updated)} chars")
    return 0


if __name__ == "__main__":
    sys.exit(main())
