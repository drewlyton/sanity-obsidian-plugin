# Sanity Publish for Obsidian

![Obsidian logo and Sanity logo together](cover-image.png)

Sanity Publish is a plugin for Obsidian that allows you to publish and sync documents from your Obsidian vault to your Sanity Studio.

## ⬇️ Installing the plugin

**Sanity Publish is in alpha and not currently available through the Community Plugins marketplace.** So, in order to install it into your Obsidian vault, you'll have to clone the repository manually. You can do that by running the following command from your vault's root directory:

```
cd .obsidian/plugins && git clone https://github.com/drewlyton/sanity-obsidian-plugin.git
```

Once the repo is cloned into your `plugins` folder, restart Obsidian and navigate to 'Settings'. You should see 'Sanity Publish' in your list of Installed Plugins. Enable the plugin and then navigate to the plugin settings to continue configuration.

## ⚙️ Plugin Settings

### Sanity API Token

In order for Obsidian to sync data with your Sanity studio, you must provide an API token for your Sanity project with _read/write access_. You can find a [guide for how to generate Sanity access tokens here](https://www.sanity.io/docs/http-auth).

**Note:** by providing this API token, you are granting 'Sanity Publish' and _any other_ installed Obsidian plugin the ability to publish to your Studio on your behalf. Tread lightly here and ensure that you trust the authors of all plugins in your vault before doing this.

### Sanity Project ID

Paste your Sanity project id into this field.

### Sanity Dataset Name

Provide the name of the dataset you'd like to publish documents to. This defaults to 'production'.

### Sanity Document Type Name

Provide the name of document type in your Sanity project's schema that you'd like to publish documents to (i.e. 'post' or 'blog')

### Sanity Title Field

Provide the field name that represents a `title` in your project's schema. Sanity Publish will sync the file name in Obsidian with this field. If you don't want to sync the file name, you can leave this blank.

### Sanity Body Field

Provide the field name that matches the body of your file's content. Sanity Publish will sync the Obsidian document's contents with this field in your studio.

## 🙌 Hitting Publish

Once you've configured the plugin settings, you can navigate to a document you'd like to publish, open the command pallete, and search for `Sanity Publish`.

Hitting enter will create or update a _draft_ document in your Sanity Studio. It will also update the frontmatter of your file in Obsidian to store the `sanity_id`. This allows you to update the document after it's initially published.

**Note** that changing or removing this `sanity_id` may have unintended consequences. However, it can also be very useful to update this ID field once you've published your document in the Studio. This allows you to update the title and body of your published document right from Obsidian!

## 🌄 Uploading Images

One convenient additional feature of Sanity Publish is the ability to upload images to Sanity from Obsidian. By right clicking on an embedded image in your Obsidian document, you can click the `Upload to Sanity` menu action and automatically have your image uploaded and the content of your document changed to link to the Sanity CDN.

This is a great thing to do right before publishing so that all of your images will be visible once they are published.

In the future, we may add the ability for this to be automatically done to all images in the document when you use the 'Publish to Sanity' command.

## 🤓 Advanced Settings

If you're like me, while working on an article I often keep previous drafts and cut content below a comment in the document. Something along the lines of:

```md
Content I want to publish

<!-- DRAFTS -->

Content I don't want to publish
```

Sanity Publish allows you to set a "Content Divider" string for this reason. Just paste your usual divider comment text and when you go to publish, the only content that will be published to Sanity will be that which is above that dividing line.

## 🙏 Contributing

Sanity Publish is currently mostly a personal pet project for my own publishing workflow. However, if you find it useful and come across any bugs or feature ideas while using it, please make a new issue here on GitHub.
