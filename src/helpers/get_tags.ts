import { getAllTags, TFile, CachedMetadata} from 'obsidian';

export function getVaultTags(): Array<string> {
    return Object.entries(this.app.metadataCache.getTags()).sort((a:any, b:any) => b[1] - a[1]).map(a=>a[0])
}

export function getTagsString(): string {
    // get every tag in the current vault
    const vaultTags: Array<string> = getVaultTags()
    console.log("All Vault Tags: ", vaultTags.length)

    // create a string of the first 100 tags to insert into the prompt
    const tagsString: string = vaultTags.slice(0, 100).map(tag => `- ${tag}`).join("\n");

    return tagsString
}