<script lang="ts">
  import InfoSection from "./InfoSection.svelte";
  import InterviewQuestionCategory from "./InterviewQuestionCategory.svelte";
  import { faQuestionCircle } from "@fortawesome/free-solid-svg-icons";
  import { resume } from "$lib/data/resume";
</script>

<InfoSection title="Common Interview Questions" icon={faQuestionCircle}>
  <div class="mb-6 p-4 bg-blue-50/50 border border-blue-200 rounded-lg">
    <p class="text-blue-800 text-sm leading-relaxed">
      <strong>STAR Method:</strong> These responses follow the STAR framework:
      <strong>Situation</strong> (context), <strong>Task</strong> (what needed to be done), 
      <strong>Action</strong> (what I did), and <strong>Result</strong> (outcome achieved).
      All examples are drawn from my real professional experience at {resume.work.map(job => job.name).join(', ')}.
    </p>
  </div>

  <div class="space-y-8">
    {#each resume.interviewQuestions as category, index (index)}
      <InterviewQuestionCategory {category} />
    {/each}
  </div>

  <div class="mt-8 p-4 bg-slate-50/50 border border-slate-200 rounded-lg">
    <p class="text-slate-700 text-sm leading-relaxed">
      <strong>Note:</strong> These examples represent real situations from my professional experience. 
      I can provide additional details, metrics, or technical specifics for any of these scenarios during our conversation. 
      All outcomes mentioned are measurable and verifiable through references or project documentation.
    </p>
  </div>
</InfoSection>
