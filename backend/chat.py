from pydantic_ai import Agent, RunContext, ModelResponse, UserPromptPart, TextPart, ModelRequest

from loguru import logger


SYSTEM_PROMPT = """
You are a friendly assistant designed to assist the user with answering questions about an audio recording they have uploaded based on information you will be provided.

# Important:
- You do not have access to the recording. NEVER ask the user to upload their recording.
- You are highly knowledgeable of all forms of music and musical style. Based on the user's responses and the information you are provided, you can provide recommendations of other musical artists or styles, depending on the user's questions. 
- Assume that the user you are talking to as an interested middle schooler. Use clear, simple, and straightforward language, and keep your responses under three sentences.

## Formatting Instructions:
- You never use emojis or non-ASCII symbols as part of your response.
- Do not use any markdown or HTML formatting in your response: only plain text is acceptable. 
- Never use asterisks to bold text. 
- Never used numbered or bullet point lists.

## Missing Information:
- You do not invent information you do not have access to. NEVER invent or hallucinate information about the recording.
- If a piece of information is given as "None" or "null" and a user requests it, simply state that you do not have access to this information, and prompt them to continue exploring their recording with the available AI functions.
"""


AGENT = Agent("gpt-4o", deps_type=dict)


@AGENT.instructions
async def provide_instructions(ctx: RunContext) -> str:
    out_str = f"""
    {SYSTEM_PROMPT}
    
    Here is information about the musical piece uploaded:
    -----------------------------------------------------
    
    Time Signature: {ctx.deps.get("time_signature", None)}
    Key: {ctx.deps.get("key", None)}
    
    Genres: {ctx.deps.get("genres", None)}
    Instruments: {ctx.deps.get("instruments", None)}
    Mood: {ctx.deps.get("mood", None)}
    Era: {ctx.deps.get("era", None)}
    
    Lyrics: {ctx.deps.get("lyrics", None)}
    Chords: {ctx.deps.get("chords", None)}
    """

    return out_str


def convert_openai_to_pydantic(messages: list[dict]) -> list:
    """Convert OpenAI-style messages to Pydantic AI ModelMessage format."""
    pydantic_messages = []

    for msg in messages:
        role = msg["role"]
        content = msg["content"]

        if role == "user":
            pydantic_messages.append(
                ModelRequest(parts=[UserPromptPart(content=content)])
            )
        elif role == "assistant":
            pydantic_messages.append(
                ModelResponse(parts=[TextPart(content=content)])
            )
        else:
            logger.error("Unexpected role: {}".format(role))
            continue

    return pydantic_messages
