"""
Chat service — full RAG orchestration: query parse → embed → retrieve → rerank → generate.
"""

import logging
from uuid import UUID

from openai import AsyncOpenAI
from sqlalchemy.orm import Session

from app.config import settings
from app.models.chat import ChatMessage, ChatSession
from app.models.opportunity import Opportunity
from app.models.user import User
from app.services.embedder import embed_query
from app.services.query_parser import understand_query
from app.services.relevance import rerank_for_user
from app.services.retriever import ScoredOpportunity, hybrid_retrieve
from app.services.reranker import rerank_with_cross_encoder
from app.services.relevance_explainer import (
    ExplanationOpportunity,
    generate_relevance_explanations,
)

logger = logging.getLogger(__name__)

_client = AsyncOpenAI(api_key=settings.openai_api_key)

_MAX_HISTORY = 10
_MAX_CITED = 5


async def handle_chat_message(
    db: Session,
    user: User,
    message: str,
    session_id: UUID | None = None,
    opportunity_id: UUID | None = None,
) -> tuple[ChatMessage, list[Opportunity], UUID]:
    """End-to-end RAG chat: returns (assistant_message, cited_opportunities, session_id)."""

    # 1. Get or create session
    session = _get_or_create_session(db, user, session_id, message)

    # 2. Save user message
    user_msg = ChatMessage(
        session_id=session.id,
        role="user",
        content=message,
    )
    db.add(user_msg)
    db.commit()

    # 7. Load chat history for context
    history = _load_history(db, session.id)

    # --- Single-opportunity mode (from browse detail page) ---
    if opportunity_id:
        return await _handle_single_opportunity_chat(
            db, user, message, session, history, opportunity_id
        )

    # --- Normal RAG flow ---
    # 3. Query understanding
    parsed = await understand_query(message)
    logger.info(f"Parsed query: intent={parsed.intent}, search='{parsed.search_text}'")

    # 4. Embed query
    query_embedding = await embed_query(parsed.search_text)

    # 5. Hybrid retrieval
    candidates = await hybrid_retrieve(db, parsed, query_embedding, limit=10)
    # 5b. Cross-encoder rerank (optional)
    candidates = rerank_with_cross_encoder(parsed.search_text, candidates)

    # 6. Profile-aware re-ranking
    ranked = rerank_for_user(user, candidates)
    top = ranked[:_MAX_CITED]

    # 8. Generate response
    response_text = await _generate_response(user, message, top, history)

    # 9. Fetch full opportunity objects for the cited ones
    cited_ids = [str(o.id) for o in top]
    cited_opps = (
        db.query(Opportunity)
        .filter(Opportunity.id.in_([o.id for o in top]))
        .all()
        if top
        else []
    )

    explanations = await generate_relevance_explanations(
        user=user,
        query_text=message,
        opportunities=[
            ExplanationOpportunity(
                id=str(o.id),
                title=o.title,
                category=o.category.value if hasattr(o.category, "value") else str(o.category),
                domain_tags=o.domain_tags,
                description=o.description,
                deadline=o.deadline.isoformat() if o.deadline else None,
                location=None,
            )
            for o in top
        ],
    )
    if explanations:
        for opp in cited_opps:
            text = explanations.get(str(opp.id))
            if text:
                setattr(opp, "relevance_explanation", text)

    # 10. Save assistant message
    assistant_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=response_text,
        cited_opportunity_ids=cited_ids,
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    return assistant_msg, cited_opps, session.id


async def _handle_single_opportunity_chat(
    db: Session,
    user: User,
    message: str,
    session: "ChatSession",
    history: list[ChatMessage],
    opportunity_id: UUID,
) -> tuple[ChatMessage, list[Opportunity], UUID]:
    """Focused chat about a single opportunity — no retrieval, no other suggestions."""
    opp = db.query(Opportunity).filter(Opportunity.id == opportunity_id).first()
    if not opp:
        content = "Sorry, I couldn't find that opportunity. It may have been removed."
        assistant_msg = ChatMessage(
            session_id=session.id, role="assistant", content=content,
            cited_opportunity_ids=[],
        )
        db.add(assistant_msg)
        db.commit()
        db.refresh(assistant_msg)
        return assistant_msg, [], session.id

    deadline_str = opp.deadline.isoformat() if opp.deadline else "No deadline"
    eligibility_str = opp.eligibility or "Not specified"
    benefits_str = opp.benefits or "Not specified"
    description_str = opp.description or ""
    location_str = opp.state or opp.location or "Not specified"
    organizer_str = opp.organizer or "Not specified"
    category_str = opp.category.value if hasattr(opp.category, "value") else str(opp.category)
    mode_str = opp.mode.value if hasattr(opp.mode, "value") else str(opp.mode) if opp.mode else "Not specified"

    system_prompt = (
        "You are Steppd, an AI assistant that helps students learn about opportunities.\n\n"
        "The student is asking about a SPECIFIC opportunity. Answer ONLY about this opportunity.\n"
        "Do NOT suggest or mention any other opportunities unless the student explicitly asks.\n\n"
        f"Opportunity details:\n"
        f"- Title: {opp.title}\n"
        f"- Category: {category_str}\n"
        f"- Deadline: {deadline_str}\n"
        f"- Mode: {mode_str}\n"
        f"- Location: {location_str}\n"
        f"- Organizer: {organizer_str}\n"
        f"- Eligibility: {eligibility_str}\n"
        f"- Benefits: {benefits_str}\n"
        f"- Description: {description_str[:1500]}\n\n"
        f"Student profile:\n"
        f"- Name: {user.first_name or 'Student'}\n"
        f"- Academic Background: {user.academic_background or 'Not specified'}\n"
        f"- Skills: {', '.join(user.skills or []) or 'Not specified'}\n"
        f"- Interests: {', '.join(user.interests or []) or 'Not specified'}\n\n"
        "Rules:\n"
        "- Focus ONLY on this opportunity. Do not recommend other opportunities.\n"
        "- NEVER generate hyperlinks, URLs, or markdown links.\n"
        "- Be concise, friendly, and actionable.\n"
        "- Highlight how this opportunity matches the student's profile if relevant.\n"
        "- Mention the deadline prominently."
    )

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history[-_MAX_HISTORY:]:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": message})

    try:
        response = await _client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            max_tokens=1024,
            temperature=0.7,
        )
        response_text = response.choices[0].message.content
    except Exception as e:
        logger.error(f"Single-opp response generation failed: {e}")
        response_text = "I'm sorry, I encountered an error. Please try again."

    cited_ids = [str(opp.id)]
    assistant_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=response_text,
        cited_opportunity_ids=cited_ids,
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    return assistant_msg, [opp], session.id


def _get_or_create_session(
    db: Session, user: User, session_id: UUID | None, message: str
) -> ChatSession:
    """Resume existing session or create a new one."""
    if session_id:
        session = (
            db.query(ChatSession)
            .filter(ChatSession.id == session_id, ChatSession.user_id == user.id)
            .first()
        )
        if session:
            return session

    title = message[:80] + ("..." if len(message) > 80 else "")
    session = ChatSession(user_id=user.id, title=title)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def _load_history(db: Session, session_id: UUID) -> list[ChatMessage]:
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )


async def _generate_response(
    user: User,
    message: str,
    retrieved: list[ScoredOpportunity],
    history: list[ChatMessage],
) -> str:
    """Generate a conversational response with GPT-4o-mini."""

    system_prompt = _build_system_prompt(user, retrieved)

    messages = [{"role": "system", "content": system_prompt}]

    for msg in history[-_MAX_HISTORY:]:
        messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": message})

    try:
        response = await _client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            max_tokens=1024,
            temperature=0.7,
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"Response generation failed: {e}")
        return (
            "I'm sorry, I encountered an error while generating a response. "
            "Please try again."
        )


def _build_system_prompt(user: User, retrieved: list[ScoredOpportunity]) -> str:
    profile_section = (
        f"Student profile:\n"
        f"- Name: {user.first_name or 'Student'}\n"
        f"- Academic Background: {user.academic_background or 'Not specified'}\n"
        f"- Year of Study: {user.year_of_study or 'Not specified'}\n"
        f"- State: {user.state or 'Not specified'}\n"
        f"- Skills: {', '.join(user.skills or []) or 'Not specified'}\n"
        f"- Interests: {', '.join(user.interests or []) or 'Not specified'}\n"
        f"- Looking for: {', '.join(user.aspirations or []) or 'Not specified'}"
    )

    opp_lines = []
    for i, opp in enumerate(retrieved, 1):
        deadline_str = opp.deadline.isoformat() if opp.deadline else "No deadline"
        context = opp.chunk_context[:300] if opp.chunk_context else opp.description[:200]
        eligibility_str = opp.eligibility[:150] if opp.eligibility else "Not specified"
        benefits_str = opp.benefits[:150] if opp.benefits else "Not specified"
        opp_lines.append(
            f"{i}. **{opp.title}**\n"
            f"   Category: {opp.category} | Deadline: {deadline_str}\n"
            f"   Eligibility: {eligibility_str}\n"
            f"   Benefits: {benefits_str}\n"
            f"   Context: {context}"
        )
    opp_section = "\n".join(opp_lines) if opp_lines else "No matching opportunities found."

    return (
        "You are Steppd, an AI assistant that helps students discover opportunities "
        "(hackathons, grants, fellowships, internships, competitions, scholarships, programs).\n\n"
        "Language: Always respond in English, regardless of the language the user writes in.\n\n"
        f"{profile_section}\n\n"
        f"Retrieved opportunities (ranked by relevance):\n{opp_section}\n\n"
        "Rules:\n"
        "- Cite opportunities that are relevant to the user's query. Use logical reasoning about eligibility: "
        "e.g. if a user asks for 'engineering students' and an opportunity is open to 'undergraduate students', "
        "that opportunity IS applicable because engineering students are undergraduates. Similarly, 'all students' "
        "includes every discipline. Always apply this inclusive logic.\n"
        "- If a retrieved opportunity has NO connection at all to the user's query topic, skip it.\n"
        "- Refer to each opportunity by its **bold title** exactly as listed above. "
        "NEVER generate hyperlinks, URLs, or markdown links — the UI renders opportunity cards automatically.\n"
        "- Explain WHY each cited opportunity is relevant, including eligibility reasoning\n"
        "- Mention deadlines prominently\n"
        "- If none of the retrieved opportunities are relevant even with inclusive eligibility reasoning, "
        "say so and suggest different keywords\n"
        "- Be concise, friendly, and actionable"
    )
