import { generateStoryObjects } from '../../../story/StoryGenerator';
import type { GenerationStage } from '../GenerationStage';

export class StoryStage implements GenerationStage {
  public readonly id = 'story-layer';

  public run(context: Parameters<GenerationStage['run']>[0]): void {
    generateStoryObjects(
      context.world,
      context.config.story,
      context.random,
      context.options.storyPositionOverrides,
      context.options.storyRuleOverrides,
      context.options.customStoryPoints,
    );
  }
}
