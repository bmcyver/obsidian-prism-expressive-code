import { TFile } from 'obsidian';
import type ShikiPlugin from 'src/main';
import { type BaseCodeBlock } from 'src/code-blocks/BaseCodeBlock';

export class CodeBlockManager {
	plugin: ShikiPlugin;
	activeCodeBlocks: Map<string, Set<BaseCodeBlock>>;

	constructor(plugin: ShikiPlugin) {
		this.plugin = plugin;
		this.activeCodeBlocks = new Map();
	}

	public registerEvents(): void {
		this.plugin.registerEvent(
			this.plugin.app.metadataCache.on('changed', file => {
				if (file instanceof TFile) {
					if (this.activeCodeBlocks.has(file.path)) {
						for (const codeBlock of this.activeCodeBlocks.get(file.path)!) {
							void codeBlock.rerenderOnNoteChange();
						}
					}
				}
			}),
		);

		this.plugin.registerEvent(
			this.plugin.app.vault.on('rename', (file, oldPath) => {
				if (file instanceof TFile) {
					if (this.activeCodeBlocks.has(oldPath)) {
						const blocks = this.activeCodeBlocks.get(oldPath)!;
						this.activeCodeBlocks.delete(oldPath);
						this.activeCodeBlocks.set(file.path, blocks);
						for (const block of blocks) {
							block.currentFilePath = file.path;
						}
					}
				}
			}),
		);
	}

	public add(codeBlock: BaseCodeBlock): void {
		const filePath = codeBlock.currentFilePath;

		if (!this.activeCodeBlocks.has(filePath)) {
			this.activeCodeBlocks.set(filePath, new Set([codeBlock]));
		} else {
			this.activeCodeBlocks.get(filePath)!.add(codeBlock);
		}
	}

	public remove(codeBlock: BaseCodeBlock): void {
		const filePath = codeBlock.currentFilePath;

		if (this.activeCodeBlocks.has(filePath)) {
			const set = this.activeCodeBlocks.get(filePath)!;
			set.delete(codeBlock);
			if (set.size === 0) {
				this.activeCodeBlocks.delete(filePath);
			}
		}
	}

	public async forceRerenderAll(): Promise<void> {
		const promises: Promise<void>[] = [];
		for (const [_, codeBlocks] of this.activeCodeBlocks) {
			for (const codeBlock of codeBlocks) {
				promises.push(codeBlock.forceRerender());
			}
		}
		await Promise.all(promises);
	}
}
