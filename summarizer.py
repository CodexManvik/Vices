conversation_summary = ""


def update_summary(history):

    global conversation_summary

    last_messages = history[-8:]

    summary = []

    for msg in last_messages:

        role = msg["role"]

        content = msg["content"]

        summary.append(
            f"{role}: {content}"
        )

    conversation_summary = "\n".join(
        summary
    )

    return conversation_summary
