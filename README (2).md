# Diagrams

Add the ER diagram, use case diagram and sequence diagrams here (draw.io, Mermaid or PlantUML).
The data model to draw from is `server/prisma/schema.prisma`. The use cases are listed in section 8 of the SRS.

A starting point for the AI tutor sequence, in Mermaid:

```mermaid
sequenceDiagram
  participant S as Student
  participant API as API server
  participant DB as Postgres + pgvector
  participant LLM as AI model
  S->>API: POST /api/ai/tutor (question)
  API->>API: check sign-in, enrollment, rate limit
  API->>DB: find 5 most similar course passages
  alt no passage is similar enough
    API-->>S: "I can't find that in this course"
  else
    API->>LLM: rules + passages + recent chat + question
    LLM-->>API: answer with [S1] citations
    API->>API: verify citations
    API-->>S: answer + source lessons
  end
```
