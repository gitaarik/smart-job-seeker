-- CreateTable
CREATE TABLE "public"."ai_responses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "context" TEXT,
    "originalContent" TEXT NOT NULL,
    "currentContent" TEXT NOT NULL,
    "llmProvider" TEXT NOT NULL,
    "llmModel" TEXT NOT NULL,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ai_refinements" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "request" TEXT NOT NULL,
    "refinedContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_refinements_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."ai_responses" ADD CONSTRAINT "ai_responses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ai_refinements" ADD CONSTRAINT "ai_refinements_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "public"."ai_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
