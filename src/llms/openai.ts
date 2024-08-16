import { ChatOpenAI } from "@langchain/openai";
import { JsonOutputKeyToolsParser, JsonOutputKeyToolsParserParams } from "@langchain/core/output_parsers/openai_tools";
import { Runnable } from '@langchain/core/runnables';
import {
    ChatPromptTemplate,
    SystemMessagePromptTemplate,
    HumanMessagePromptTemplate,
} from "@langchain/core/prompts";


import { LLM } from './base'
import { TagDocumentTool } from '../tool'
import { getTagsString as getVaultTagsString } from '../helpers/get_tags';
import type { AiTaggerSettings } from '../main';
// write a class to instantiate the chain and handle the prompts
export class OpenAiLLM extends LLM {
    baseURL: string | null;
    model: Runnable;
    prompt: ChatPromptTemplate;

    constructor(modelId: string, apiKey: string, private settings: AiTaggerSettings) {
        super(modelId, apiKey)
        this.baseURL = settings.custom_base_url;
        this.prompt = this.getPrompt();
        this.model = this.getModel();
    }

    getPrompt() {
        const systemMessage = this.settings.systemPrompt;

        const humanMessage = "DOCUMENT:\n```{document}```"

        const prompt = ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(systemMessage),
            HumanMessagePromptTemplate.fromTemplate(humanMessage),
        ]);

        return prompt;
    }

    getModel() {
        let model: ChatOpenAI;
        try {
            model = new ChatOpenAI({
                modelName: this.modelInfo.modelId,
                openAIApiKey: this.apiKey,
                temperature: 0.0,
                configuration: {
                    baseURL: this.baseURL,
                    timeout: 20_000, // 10 seconds
                }
            });
        } catch (error) {
            if (error.message.includes('OpenAI or Azure OpenAI API key not found')) {
                // Notify the user about the incorrect API key
                throw new Error('Incorrect OpenAI API key. Please check your API key.');
            } else {
                console.error('Error while instantiating model:', error.message);
                throw new Error('Error while instantiating model.');
            }
        }

        // check if model allows tool use (aka function calling)
        if (this.modelInfo.toolUse === true) {
            const tagDocumentTool = new TagDocumentTool()
            // Bind the tool to the model
            const modelWithTool: Runnable = model.bind({
                tools: [tagDocumentTool],
                tool_choice: {
                    type: "function" as const,
                    function: {
                        name: tagDocumentTool.name,
                    },
                },
            });

            const outputParser: Runnable = new JsonOutputKeyToolsParser({
                keyName: tagDocumentTool.name,
                returnSingle: true,
            });

            const modelWithOutputParser = modelWithTool.pipe(outputParser)

            return modelWithOutputParser
        }

        return model;
    }

    async generateTags(documentText: string, currentTags?: string[]): Promise<Array<string>> {
        const chain: Runnable = this.prompt.pipe(this.model)

        const tagsString: string = getVaultTagsString()

        try {
            const response = await chain.invoke({
                tagsString: tagsString,
                document: documentText,
                currentTags: currentTags?.map(tag => `- ${tag}`).join("\n"),
            });

            console.debug("LLM Response: ", response)

            const tags: Array<string> = this.formatOutputTags(response.tags, response.newTags)
            return tags
        } catch (error) {
            // print the type of error
            console.error('Error while invoking chain:', error.message);
            if (error.message.includes('Incorrect API key')) {
                // Notify the user about the incorrect API key
                throw new Error('Incorrect API key. Please check your API key.');
                // } else if (error.message.includes('Invalid Authentication')) {
                //     // Notify the user about the incorrect API key
                //     throw new Error('Incorrect API key. Please check your API key.');
                // } else if (error.message.includes('You must be a member of an organization to use the API')) {
                //     // Notify the user about the incorrect API key
                //     throw new Error('Your account is not part of an organization.  Contact OpenAI to get added to a new organization or ask your organization manager to invite you to an organization.');
            } else if (error.message.includes('Rate limit reached for requests')) {
                // Notify the user about the incorrect API key
                throw new Error('You are sending requests too quickly. Please pace your requests or read OpenAI\'s Rate limit guide.');
            } else if (error.message.includes('You exceeded your current quota, please check your plan and billing details')) {
                // Notify the user about running out of credits
                throw new Error('You have run out of OpenAI credits or hit your maximum monthly spend.');
            } else if (error.message.includes('The server had an error while processing your request')) {
                // Notify the user about an issue with OpenAI's servers
                throw new Error('Issue on OpenAI\'s servers. Please retry your request after a brief wait.');
            } else if (error.message.includes('The engine is currently overloaded, please try again later')) {
                // Notify the user about an issue with OpenAI's servers
                throw new Error('OpenAI\'s servers are experiencing high traffic. Please retry your requests after a brief wait.');
            } else if (error.message.includes('Please reduce the length')) {
                // Notify the user about the context length being too large
                throw new Error('Your document is too long. Please reduce the length of your document.');
            } else if (error.message.includes('Invalid URL')) {
                // Notify the user about the incorrect custom base URL
                throw new Error('Invalid custom base URL provided. Please check your custom base URL.');
            } else if (error.message.includes('Connection error') && this.baseURL !== null && (this.modelName.includes('gpt-4') || this.modelName.includes('gpt-3.5-turbo'))) {
                // Notify the user about the incorrect custom base URL
                throw new Error('Could not connect to custom base URL provided. Please check your custom base URL.');
            } else {
                console.error('Error while generating tags:', error.message);
                throw new Error('Error while generating tags.');
            }

        }
    }
}
