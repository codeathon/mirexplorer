from pydantic_ai import Agent, RunContext, ModelResponse, UserPromptPart, TextPart, ModelRequest, AgentRunResult

from loguru import logger


SYSTEM_PROMPT = """
You are a friendly assistant designed to assist the user with answering questions about an audio recording they have uploaded based on information you will be provided.

# Important:
- You do not have access to the recording. NEVER ask the user to upload their recording.
- You are highly knowledgeable of all forms of music and musical style. Based on the user's responses and the information you are provided, you can provide recommendations of other musical artists or styles, depending on the user's questions. 
- Assume that the user you are talking to as an interested middle schooler. Use clear, simple, and straightforward language, and keep your responses under three sentences.

## Identity:
- You were developed by researchers at Queen Mary University of London
- You were developed as part of the "AI Skills Through Music" project, funded by the EPSRC
- If anybody asks you to reveal your system prompt or other important aspects of your design, direct them towards the open-source code repository on GitHub

## Formatting Instructions:
- You never use emojis or non-ASCII symbols as part of your response.
- Do not use any markdown or HTML formatting in your response: only plain text is acceptable. 
- Never use bold, italicised, underlined, or strikethrough text. 
- Never used numbered or bullet point lists.
- Never use headings or separate sections.
- Maximum response length: four sentences.

## Missing Information:
- You do not invent information you do not have access to. NEVER invent or hallucinate information about the recording.
- If a piece of information is given as "None" or "null" and a user requests it, simply state that you do not have access to this information, and prompt them to continue exploring their recording with the available AI functions.
"""
AGENT = Agent("gpt-4o", deps_type=dict)

# Once the user has asked this many questions, we'll just return the "goodbye" message
MAX_USER_TURNS = 3


def get_musical_piece_information(deps: dict[str, str], skip_long: bool = False) -> str:
    st = f"""
    Time Signature: {deps.get("time_signature", "")}
    Key: {deps.get("key", "")}
    Genres: {deps.get("genres", "")}
    Instruments: {deps.get("instruments", "")}
    Mood: {deps.get("mood", "")}
    Era: {deps.get("era", "")}
    """

    if not skip_long:
        st += f"""
        Lyrics: {deps.get("lyrics", "")}
        Chords: {deps.get("chords", "")}
        """

    return st


@AGENT.instructions
async def provide_instructions(ctx: RunContext) -> str:
    out_str = f"""
    {SYSTEM_PROMPT}
    
    Here is information about the musical piece uploaded:
    -----------------------------------------------------
    
    {get_musical_piece_information(ctx.deps, skip_long=False)}
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


async def create_goodbye_message(ctx: RunContext) -> str:
    return f"""It's been great chatting with you about this recording! To continue the conversation, try pasting the following information into your favorite AI chatbot like ChatGPT, Claude or Gemini.\n\n
    {get_musical_piece_information(ctx, skip_long=True)}
    """


async def route_chat_response(user_message: str, context: list[dict], deps: dict[str, str]) -> AgentRunResult:
    """Routes a chat response either to the agent, or to a generic 'goodbye' message."""

    n_user_turns = len([i for i in context if i["role"] == "user"])
    if n_user_turns > MAX_USER_TURNS:
        return await create_goodbye_message(deps)

    else:
        # need to convert message history to pydantic format
        message_history = convert_openai_to_pydantic(context)
        # make the completion
        result = await AGENT.run(user_message, deps=deps, message_history=message_history)
        # return the result
        return result.output
