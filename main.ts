import {
	App,
	FileSystemAdapter,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";
import matter from "gray-matter";
import mime from "mime";
import {
	SanityClient,
	createClient as createSanityClient,
} from "@sanity/client";
import { readFile } from "fs/promises";

interface SanityPluginSettings {
	apiToken: string | undefined;
	projectId: string | undefined;
	dataset: string;
	sanityTypeName: string;
	sanityTitleField?: string;
	sanityBodyField: string;
}

const DEFAULT_SETTINGS: SanityPluginSettings = {
	apiToken: "",
	projectId: "",
	dataset: "production",
	sanityTypeName: "post",
	sanityBodyField: "body",
};

const httpRegex =
	/^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/;

export default class SanityPublishPlugin extends Plugin {
	settings: SanityPluginSettings;
	client: SanityClient;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "sanity-publish-command",
			name: "Publish to Sanity",
			checkCallback: (checking) => {
				const activeFile = this.app.workspace.getActiveFile();

				if (!activeFile) {
					if (checking) return false;
					return;
				} else if (checking) {
					return true;
				}
				this.getFileData(activeFile).then(({ content, data }) => {
					new Notice("Publishing content to Sanity...");
					this.createorUpdateDocument({
						content,
						title: activeFile.basename,
						sanityId: data?.sanity_id,
					}).then((r) => {
						if (r?._id) {
							this.updateFrontmatter({ sanity_id: r._id });
							new Notice("Succesffuly  content to Sanity!");
						}
					});
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

	async uploadFileToSanity(path: string) {
		const file = await readFile(path);
		const fileType = mime.getType(path);
		return await this.client.assets.upload(
			fileType?.includes("image") ? "image" : "file",
			file
		);
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

	async getFileData(file: TFile) {
		if (file) {
			const fileText = await this.app.vault.read(file);
			return matter(fileText);
		}
		throw new Error("No active file found.");
	}

	async updateFrontmatter(updatedProperties: {
		[x: string]: string | string[];
	}) {
		const currentFile = this.app.workspace.getActiveFile();
		if (currentFile) {
			const { content, data } = await this.getFileData(currentFile);
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
}

class SanitySettingTab extends PluginSettingTab {
	plugin: SanityPublishPlugin;

	constructor(app: App, plugin: SanityPublishPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Sanity API Token")
			.setDesc(
				"Your token must have write-access for the project you wish to publish to."
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter Your Token")
					.setValue(this.plugin.settings.apiToken || "")
					.onChange(async (value) => {
						this.plugin.settings.apiToken = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Project ID")
			.setDesc("Your Sanity project's ID.")
			.addText((text) =>
				text
					.setPlaceholder("Enter Your Id")
					.setValue(this.plugin.settings.projectId || "")
					.onChange(async (value) => {
						this.plugin.settings.projectId = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Dataset Name")
			.setDesc(
				"The name of the dataset you'd like to publish to (defaults to `production`)."
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter Your Dataset's Name")
					.setValue(this.plugin.settings.dataset || "production")
					.onChange(async (value) => {
						this.plugin.settings.dataset = value || "production";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Sanity Type Name")
			.setDesc(
				"The name of the document type you want to sync with in Sanity (defaults to 'post')."
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter Your Type Name")
					.setValue(this.plugin.settings.sanityTypeName || "post")
					.onChange(async (value) => {
						this.plugin.settings.sanityTypeName = value || "post";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Sanity Title Field")
			.setDesc(
				"The name of the field you'd like to sync your title with (leave blank if you don't want to sync this field)."
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter Your Field Name")
					.setValue(this.plugin.settings.sanityTitleField || "")
					.onChange(async (value) => {
						this.plugin.settings.sanityTitleField = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Sanity Body Field")
			.setDesc(
				"The name of the field you'd like to sync the body of your document with (defaults to 'body')."
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter Your Field Name")
					.setValue(this.plugin.settings.sanityBodyField || "body")
					.onChange(async (value) => {
						this.plugin.settings.sanityBodyField = value || "body";
						await this.plugin.saveSettings();
					})
			);
	}
}
