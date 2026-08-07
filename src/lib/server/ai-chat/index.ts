/**
 * AI Chat module - re-exports all AI chat related functionality
 */

// Core utilities
export {
	createAndGenerateAiChat,
	getInterpolatedPrompts,
	interpolatePrompt,
	makeFullPrompt
} from './utils';

// Response generation
export { generateAiChatResponse } from './response-generate';

// Follow-up creation
export { createFollowupAiChat } from './create-followup';

// Full prompt generation
export { generateAiChatFullPrompt } from './full-prompt-generate';

// Job utilities
export { createJobMatchingAiChat, createJobScrapingAiChat } from './job-utils';

// Application letter generation
export { generateApplicationLetter } from './application-letter';
export { createApplicationLetterFollowup } from './application-letter-followup';

// Application question generation
export { generateApplicationQuestionAnswer } from './application-question';
export { createApplicationQuestionFollowup } from './application-question-followup';
