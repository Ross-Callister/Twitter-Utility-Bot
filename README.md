# Discord Utility Bot

A Discord bot that automatically downloads media from Twitter/X posts in designated channels.

## Features

- Automatically downloads images and videos from Twitter/X links
- Configurable monitoring per channel
- Persistent settings using SQLite database
- Support for protected/sensitive content with cookie authentication

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the root directory with your Discord bot token:

   ```
   DISCORD_TOKEN="your_discord_token_here"
   ```

3. Run the bot:
   ```bash
   npm run dev    # For development with auto-reload
   npm start      # For production
   ```

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

- `!config download` - Toggles whether the current channel should be monitored for Twitter media downloads
  - Only server administrators can use this command
  - The bot will react with a confirmation message

### Twitter Authentication

- `!cookie <value>` - Sets the Twitter authentication cookie (required for accessing protected/sensitive content)
  - Only server administrators can use this command
  - The cookie value will be stored securely in the database
  - The command message will be automatically deleted for security

## How it Works

1. When the bot starts, it creates a SQLite database to store settings and monitored channels
2. The bot will only download media from channels that have been configured using `!config download`
3. When a Twitter/X link is posted in a monitored channel:
   - The bot reacts with 👍 to acknowledge
   - Downloads any media (images/videos) from the tweet
   - Saves the media to the `downloads` folder
   - Reports any errors if the download fails

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
