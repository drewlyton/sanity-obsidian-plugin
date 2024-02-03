import { App, PluginSettingTab, Setting } from "obsidian";
import SanityPublishPlugin from "main";

export interface SanityPluginSettings {
	apiToken: string | undefined;
	projectId: string | undefined;
	dataset: string;
	sanityTypeName: string;
	sanityTitleField?: string;
	sanityBodyField: string;
	contentDivider?: string;
}

export const DEFAULT_SETTINGS: SanityPluginSettings = {
	apiToken: "",
	projectId: "",
	dataset: "production",
	sanityTypeName: "post",
	sanityBodyField: "body",
	contentDivider: "",
};

export class SanitySettingTab extends PluginSettingTab {
	plugin: SanityPublishPlugin;

	constructor(app: App, plugin: SanityPublishPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("br");
		containerEl.createEl("h3", { text: "Sanity configuration" });

		new Setting(containerEl)
			.setName("Sanity API token")
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
			.setName("Dataset name")
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

		containerEl.createEl("br");
		containerEl.createEl("h3", { text: "Schema configuration" });

		new Setting(containerEl)
			.setName("Type name")
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
			.setName("Title field")
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
			.setName("Body field")
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

		containerEl.createEl("br");
		containerEl.createEl("h3", { text: "Advanced" });

		new Setting(containerEl)
			.setName("Content divider")
			.setDesc(
				"An optional dividing string for your content. If this string is in your document, anything below it won't be published."
			)
			.addText((text) =>
				text
					.setPlaceholder("Enter your divider")
					.setValue(this.plugin.settings.contentDivider || "")
					.onChange(async (value) => {
						this.plugin.settings.contentDivider = value || "";
						await this.plugin.saveSettings();
					})
			);
	}
}
