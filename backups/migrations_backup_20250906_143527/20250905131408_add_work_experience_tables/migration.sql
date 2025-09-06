-- CreateTable
CREATE TABLE "public"."work_experiences" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "url" TEXT,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "summary" TEXT NOT NULL,
    "logo" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."work_highlights" (
    "id" TEXT NOT NULL,
    "workExperienceId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT NOT NULL,
    "iconName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_highlights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."work_highlight_tags" (
    "id" TEXT NOT NULL,
    "highlightId" TEXT NOT NULL,
    "tagName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_highlight_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."work_technologies" (
    "id" TEXT NOT NULL,
    "workExperienceId" TEXT NOT NULL,
    "technologyName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_technologies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."work_projects" (
    "id" TEXT NOT NULL,
    "workExperienceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_projects_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."work_highlights" ADD CONSTRAINT "work_highlights_workExperienceId_fkey" FOREIGN KEY ("workExperienceId") REFERENCES "public"."work_experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_highlight_tags" ADD CONSTRAINT "work_highlight_tags_highlightId_fkey" FOREIGN KEY ("highlightId") REFERENCES "public"."work_highlights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_technologies" ADD CONSTRAINT "work_technologies_workExperienceId_fkey" FOREIGN KEY ("workExperienceId") REFERENCES "public"."work_experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."work_projects" ADD CONSTRAINT "work_projects_workExperienceId_fkey" FOREIGN KEY ("workExperienceId") REFERENCES "public"."work_experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
