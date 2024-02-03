import {
	FileSystemAdapter,
	MarkdownEditView,
	MarkdownView,
	Notice,
	Plugin,
	TFile,
	setIcon,
} from "obsidian";
import matter from "gray-matter";
import mime from "mime";
import {
	SanityClient,
	createClient as createSanityClient,
} from "@sanity/client";
import { readFile } from "fs/promises";
import {
	DEFAULT_SETTINGS,
	SanityPluginSettings,
	SanitySettingTab,
} from "SanitySettingTab";

const httpRegex =
	/^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/;

export default class SanityPublishPlugin extends Plugin {
	settings: SanityPluginSettings;
	client: SanityClient;
	statusBarButton: HTMLElement | undefined;

	async onload() {
		await this.loadSettings();

		this.registerEvent(
			this.app.workspace.on("file-open", (file) => {
				if (!file || !(file.extension === "md")) {
					this.removeStatusBarButton();
					return;
				}
				this.addStatusBarButton(file);
			})
		);

		this.addCommand({
			id: "sanity-publish-command",
			name: "Publish to Sanity",
			checkCallback: (checking) => {
				const activeView =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				const activeFile = this.app.workspace.getActiveFile();

				if (!activeView || !activeFile) {
					if (checking) return false;
					return;
				} else if (checking) {
					return true;
				}

				this.uploadAllImages().then(() => {
					this.publishToSanity(activeFile);
				});
			},
		});

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor, info) => {
				const lineNumber = editor.getCursor().line;
				const line = editor.getLine(lineNumber);
				const filePath = this.getFilePathFromLine(line);
				if (!filePath) return;

				const fileMetaData =
					this.app.metadataCache.getFirstLinkpathDest(filePath, "");
				if (!fileMetaData) return;

				const absolutePath = this.getAbsolutePath(fileMetaData);
				if (!absolutePath) return;

				menu.addItem((item) => {
					item.setTitle("Upload to Sanity")
						.setIcon("file-up")
						.onClick(() => {
							const uploadText = `![uploading file...](${filePath})`;
							editor.setLine(lineNumber, uploadText);
							this.uploadFileToSanity(absolutePath)
								.then((value) => {
									const assetText = `![${value.originalFilename}](${value.url})`;
									editor.setLine(lineNumber, assetText);
								})
								.catch((r) => {
									const errorText = `![Couldn't upload file](${filePath})`;
									editor.setLine(lineNumber, errorText);
								});
						});
				});
			})
		);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SanitySettingTab(this.app, this));
	}

	onunload() {}

	addStatusBarButton(file: TFile) {
		if (this.statusBarButton) return;
		const statusButton = this.addStatusBarItem();
		const iconSpan = statusButton.createEl("span");
		setIcon(iconSpan, "file-up");
		statusButton.createEl("span", {
			text: "Publish",
		});

		statusButton.addClass("mod-clickable");
		statusButton.setAttr("aria-label", "Publish to Sanity");
		statusButton.setAttr("data-tooltip-position", "top");
		statusButton.addEventListener("click", () =>
			this.uploadAllImages().then(() => this.publishToSanity(file))
		);
		this.statusBarButton = statusButton;
	}

	removeStatusBarButton() {
		if (this.statusBarButton) this.statusBarButton.remove();
		this.statusBarButton = undefined;
	}

	async uploadAllImages() {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;
		const editor = view.editor;
		if (!editor) return;

		const content = view.getViewData();
		const lines = content.split("\n");
		// TODO: figure out why this function is resolving before these promises do
		await Promise.all(
			lines.map(async (line, lineNumber) => {
				const filePath = this.getFilePathFromLine(line);
				if (!filePath) return;

				const fileMetaData =
					this.app.metadataCache.getFirstLinkpathDest(filePath, "");
				if (!fileMetaData) return;

				const absolutePath = this.getAbsolutePath(fileMetaData);
				if (!absolutePath) return;

				const uploadText = `![uploading file...](${filePath})`;
				editor.setLine(lineNumber, uploadText);
				try {
					const value = await this.uploadFileToSanity(absolutePath);
					const assetText = `![${value.originalFilename}](${value.url})`;
					editor.setLine(lineNumber, assetText);
				} catch {
					const errorText = `![Couldn't upload file](${filePath})`;
					editor.setLine(lineNumber, errorText);
				}
			})
		);
	}

	async sleep(delay: number) {
		return new Promise((resolve) => setTimeout(resolve, delay));
	}

	publishToSanity(activeFile: TFile) {
		this.getViewData().then(({ content, data }) => {
			new Notice("Publishing content to Sanity...");
			this.createorUpdateDocument({
				content,
				title: activeFile.basename,
				sanityId: data?.sanity_id,
			})
				.then((r) => {
					if (r?._id) {
						this.updateFrontmatter({ sanity_id: r._id });
						new Notice("Successfully published content to Sanity!");
					}
				})
				.catch(() => {
					new Notice(
						"Something went wrong when publishing to Sanity"
					);
				});
		});
	}

	createClient() {
		if (this.settings.projectId)
			this.client = createSanityClient({
				projectId: this.settings.projectId,
				dataset: this.settings.dataset,
				token: this.settings.apiToken,
				apiVersion: "2023-05-03",
				useCdn: true,
			});
	}

	async uploadFileToSanity(path: string) {
		const file = await readFile(path);
		const fileType = mime.getType(path);
		const response = await this.client.assets.upload(
			fileType?.includes("image") ? "image" : "file",
			file
		);
		return response;
	}

	async createorUpdateDocument({
		title,
		content,
		sanityId,
	}: {
		title: string;
		content: string;
		sanityId: string;
	}) {
		const _type = this.settings.sanityTypeName;
		const titleField = this.settings.sanityTitleField;
		const bodyField = this.settings.sanityBodyField;
		// If we have a content divider,
		// split the content by that string
		// return the top/first item
		if (this.settings.contentDivider) {
			content = content.split(this.settings.contentDivider)[0];
		}
		let attributes = { [bodyField]: content };
		if (titleField) attributes[titleField] = title;

		if (!this.client) throw new Error("No Sanity client present...");
		if (!sanityId) {
			const result = await this.client.create({
				_type,
				_id: `drafts.`,
				...attributes,
			});
			return result;
		}
		const result = await this.client
			.patch(sanityId)
			.set(attributes)
			.commit();

		return result;
	}

	getAbsolutePath(file: TFile) {
		const adapter = this.app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			const basePath = adapter.getBasePath();
			return basePath + "/" + file.path;
		}
	}

	getFilePathFromLine(line: string) {
		// See if it matches either an Obsidian embed or normal md embed
		const matches = line.match(/!\[\[(.*?)\]\]|!\[.\]\((.*?)\)/);
		if (!matches) return;
		// Don't upload if already a URL
		if (matches?.[2]?.match(httpRegex)) return;
		// TODO: figure out full absolute path to asset
		const filePath = matches?.[1] || matches?.[2];
		return filePath;
	}

	async getViewData() {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (activeView) {
			return matter(activeView.getViewData());
		}
		throw new Error("No active view available.");
	}

	async updateFrontmatter(updatedProperties: {
		[x: string]: string | string[];
	}) {
		const currentFile = this.app.workspace.getActiveFile();
		if (currentFile) {
			const { content, data } = await this.getViewData();
			const updatedFrontmatter =
				matter
					.stringify("", {
						...data,
						...updatedProperties,
					})
					.trimEnd() + "\n";

			// Update the content with the modified frontmatter
			const updatedContent = updatedFrontmatter + content;

			// Save the updated content back to the file
			this.app.vault.modify(currentFile, updatedContent);
		} else {
			console.error("No active file found.");
		}
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
		this.createClient();
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.createClient();
	}
}
