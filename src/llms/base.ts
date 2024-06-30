import { Notice } from 'obsidian';
import { ModelInfo, models } from '../models'

export abstract class LLM {
    modelInfo: ModelInfo;
    modelName: string;
    apiKey: string;

    constructor(modelId: string, apiKey: string) {
        this.modelInfo = this.getModelInfobyId(modelId);
        this.modelName = this.modelInfo.modelName;
        this.apiKey = apiKey;
    }

    getModelInfobyId(modelId: string): ModelInfo {
        const modelInfo: ModelInfo | undefined = models.find((model) => model.modelId === modelId);

        if (typeof modelInfo === 'undefined') {
            throw new Error(`Model ${modelId} is not supported.`);
        }

        return modelInfo;
    }

    isTextWithinLimit(prompt: string, text: string): boolean {
        // Define token limits for the models
        const tokenLimit: number = this.modelInfo.tokenLimit;

        // Calculate the number of tokens based on average token length (4 characters)
        const promptTokens = prompt.length / 4;
        const textTokens = text.length / 4;

        const totalTokens = promptTokens + textTokens;

        return totalTokens <= tokenLimit;
    }

    formatOutputTags(tags: Array<string>, newTags: Array<string>): Array<string> {
        const tagsArray = new Set([...tags, ...newTags])
        return Array.from(tagsArray)
    }

    abstract generateTags(documentText: string, currentTags?: string[]): Promise<Array<string>>;
}