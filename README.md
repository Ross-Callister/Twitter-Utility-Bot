# Discord Utility Bot

A Discord bot that automatically downloads media from Twitter/X posts, e621 posts, Reddit posts/galleries, and can reverse search images using SauceNAO to find their original sources.

## Features

- Automatically downloads images and videos from Twitter/X links
- Downloads images from e621 links
- Downloads images from Reddit posts and galleries with intelligent source detection
- Reverse searches direct image URLs using SauceNAO to find original sources
- Automatically routes found sources to appropriate downloaders (Twitter, e621, or Reddit)
- Configurable monitoring per channel
- Persistent settings using SQLite database
- Support for protected/sensitive content with cookie authentication
- Automatic image sorting using AI-powered classification
- Rate-limited gallery downloads (40-second delays between images)## Setup

1. Install dependencies:

   ```bash
   yarn install
   ```

2. Create a `.env` file in the root directory with your Discord bot token and API keys:

   ```
   DISCORD_TOKEN="your_discord_token_here"
   ADMIN_USER_ID="your_admin_user_id_here"
   FEATHERLESS_API_KEY="your_featherless_api_key_here"

   # For e621 downloads (optional, but recommended for rate limiting)
   E621_USERNAME="your_e621_username"
   E621_API_KEY="your_e621_api_key"

   # For SauceNAO reverse image searching
   SAUCENAO_API_KEY="your_saucenao_api_key"

   # AWS credentials for image processing
   AWS_ACCESS_KEY_ID="your_aws_access_key"
   AWS_SECRET_ACCESS_KEY="your_aws_secret_key"
   AWS_DEFAULT_REGION="us-east-1"
   ```

3. Run the bot:
   ```bash
   yarn dev    # For development with auto-reload
   yarn start  # For production
   ```

## API Key Setup

- **SauceNAO API Key**: Get one free at https://saucenao.com/user.php (30 searches per 30 seconds)
- **e621 API Key**: Register at https://e621.net and generate an API key in your account settings
- **Featherless API Key**: Required for AI image classification, get one at https://featherless.ai

## Docker Deployment

### Prerequisites

- Docker and Docker Compose installed on your system
- Your Discord bot token

### Setup and Run

1. Create a `.env` file in the project root with your Discord token:

   ```
   DISCORD_TOKEN=your_discord_token_here
   ```

2. Build and start the container:
   ```bash
   docker-compose up --build -d
   ```

### Data Persistence

The bot uses two persistent volumes:

- `./data`: Contains the SQLite database (`data.db`)
- `./downloads`: Stores downloaded media files

These directories are mounted as volumes in the container, ensuring that:

- Your database persists between container restarts
- Downloaded media remains accessible on the host machine
- Configuration and monitored channels are preserved

### Maintenance

- View logs: `docker-compose logs -f`
- Restart bot: `docker-compose restart`
- Stop bot: `docker-compose down`
- Update and rebuild: `docker-compose up --build -d`

## Commands

### Channel Configuration

- `!config download` - Toggles whether the current channel should be monitored for media downloads
  - Only server administrators can use this command
  - The bot will react with a confirmation message

### Authentication

Instructions for getting Twitter cookie: https://github.com/TobyG74/twitter-downloader

- `!cookie <value>` - Sets the Twitter authentication cookie (required for accessing protected/sensitive content)
  - Only server administrators can use this command
  - The cookie value will be stored securely in the database
  - The command message will be automatically deleted for security

### Manual Downloads

- `!sauce <image_url>` - Manually reverse search an image using SauceNAO and download from the original source

  - Requires a direct image URL (ending in .jpg, .png, .gif, etc.)
  - Will automatically route to Twitter or e621 downloaders based on the found source
  - Only works in monitored channels

- `!reddit <reddit_url>` - Manually download media from a Reddit post or gallery
  - Supports both single image posts and multi-image galleries
  - For galleries, downloads each image with 40-second delays to respect rate limits
  - Uses SauceNAO to find original sources for each image
  - Only works in monitored channels

## How it Works

1. When the bot starts, it creates a SQLite database to store settings and monitored channels
2. The bot will only download media from channels that have been configured using `!config download`
3. When a supported link is posted in a monitored channel:
   - **Twitter/X links**: The bot reacts with 👍, downloads media, and automatically sorts images
   - **e621 links**: The bot downloads the image and sorts it automatically
   - **Reddit links**: The bot reacts with 📱, processes posts/galleries, uses SauceNAO to find sources, and downloads via appropriate methods
   - **Direct image URLs**: The bot uses SauceNAO to reverse search the image, finds the original source, and downloads using the appropriate method
4. For Reddit galleries, each image is processed individually with 40-second delays to respect API rate limits
5. All downloaded images are automatically sorted into categorized folders using AI-powered classification
6. The bot reports any errors if downloads fail

## File Structure

- `downloads/` - Directory where downloaded media is stored
- `data.db` - SQLite database storing bot configuration
- `.env` - Environment variables (Discord token)

## Requirements

- Node.js 16 or higher
- Discord.js v14
- SQLite3

## Error Handling

- If the Twitter cookie is not set, the bot will prompt administrators to set it
- Failed downloads will be reported in the Discord channel
- Invalid commands will be ignored
