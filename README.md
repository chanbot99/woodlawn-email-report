# New Homeowners Extractor

A production-ready tool that extracts weekly residential property sales from Tennessee Property Assessment Data (TPAD) for Tipton County, TN. Perfect for lawn care businesses, home service providers, and real estate professionals who want to reach new homeowners first.

## Features

- **Automated Weekly Extraction**: Runs every Monday to capture the previous week's residential sales
- **Smart Filtering**: Excludes non-arm's-length transfers (quitclaim, inheritance, etc.)
- **Email Reports**: Beautiful HTML reports delivered via SendGrid with CSV attachment
- **Multiple Output Formats**: CSV and JSON with standardized columns
- **Docker Support**: Easy deployment with pre-configured containers
- **GitHub Actions**: Automated scheduling with artifact storage
- **Extensible**: Easy to adapt for other Tennessee counties

## Quick Start

### Prerequisites

- Node.js 20 or higher
- npm or yarn
- SendGrid account (for email delivery)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/newhomeowners.git
cd newhomeowners

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Copy and configure environment
cp env.example .env
# Edit .env with your settings
```

### Configuration

Edit `.env` with your configuration:

```bash
# Required for email delivery
SENDGRID_API_KEY=your_sendgrid_api_key
EMAIL_TO=your_email@example.com
EMAIL_FROM=reports@yourdomain.com

# Optional customization
OUT_DIR=./data
CONCURRENCY=3
MIN_SALE_PRICE=1000
```

### Usage

```bash
# Build the project
npm run build

# Run for previous week (default)
node dist/index.js

# Run for a specific week (provide Monday date)
node dist/index.js --week 2025-12-01

# Dry run (no email sent)
node dist/index.js --dry-run

# Or use convenience scripts:
npm run extract              # Previous week
npm run extract:dry          # Dry run (no email)

# Development mode (uses tsx, no build needed)
npm run dev -- --dry-run
```

> **Note**: Due to npm argument parsing, it's recommended to use `node dist/index.js` directly when passing options like `--week`.

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-w, --week <date>` | Monday of the week to process (YYYY-MM-DD) | Previous week |
| `-o, --out <dir>` | Output directory | `./data` |
| `-d, --dry-run` | Run without sending email | `false` |
| `--test-email` | Send a test email to verify configuration | - |

## Output Files

The extractor generates three files per run:

1. **`raw_export_YYYY_MM_DD.csv`** - Raw data as extracted from TPAD
2. **`cleaned_sales_YYYY_MM_DD.csv`** - Filtered and standardized sales data
3. **`cleaned_sales_YYYY_MM_DD.json`** - JSON format with metadata and statistics

### Cleaned Output Columns

| Column | Description |
|--------|-------------|
| `parcel_id` | County parcel identifier |
| `situs_address` | Property street address |
| `city` | City name |
| `state` | State (TN) |
| `zip` | ZIP code |
| `owner_name` | Current owner name |
| `owner_mailing_address` | Owner's mailing address (if available) |
| `sale_date` | Date of sale (ISO format) |
| `sale_price` | Sale price in USD |
| `deed_instrument` | Type of deed (Warranty Deed, etc.) |
| `land_use` | Property classification |
| `source_url` | Link to TPAD parcel page |
| `extracted_at` | Timestamp of extraction |

## Docker Deployment

### Using Docker Compose

```bash
# Build and run
docker-compose up newhomeowners

# Run with specific week
docker-compose run newhomeowners --week 2025-01-06

# Development mode
docker-compose --profile dev up newhomeowners-dev
```

### Using Docker directly

```bash
# Build the image
docker build -t newhomeowners .

# Run extraction
docker run -v $(pwd)/data:/app/data \
  -e SENDGRID_API_KEY=your_key \
  -e EMAIL_TO=your@email.com \
  newhomeowners --out /app/data
```

## GitHub Actions

The repository includes automated workflows:

### Weekly Report (`weekly-report.yml`)

Runs every Monday at 6:00 AM Central Time:

1. Extracts previous week's sales from TPAD
2. Filters for arm's-length residential transactions
3. Sends email report via SendGrid
4. Uploads artifacts for 90-day retention

#### Required Secrets

Set these in your repository settings:

| Secret | Description |
|--------|-------------|
| `SENDGRID_API_KEY` | SendGrid API key |
| `EMAIL_TO` | Recipient email address |
| `EMAIL_FROM` | Sender email address |
| `S3_BUCKET` | (Optional) S3 bucket for backup |
| `AWS_REGION` | (Optional) AWS region |
| `AWS_ACCESS_KEY_ID` | (Optional) AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | (Optional) AWS credentials |

#### Manual Trigger

You can manually trigger the workflow from the Actions tab with custom parameters.

## Filtering Logic

Records are filtered to identify legitimate arm's-length sales:

### Included
- Residential properties (classification 00)
- Sale price > $1,000 (configurable)
- Warranty deeds and similar instruments

### Excluded
- Quitclaim deeds
- Deeds of Trust
- Sheriff's deeds
- Executor/Trustee deeds
- Tax deeds
- Corrections/Releases
- Family transfers

The instrument denylist is configurable via `INSTRUMENT_DENYLIST` environment variable.

## Extending to Other Counties

To use this for other Tennessee counties:

1. Find the county code in `src/config/selectors.ts`
2. Set the `COUNTY_CODE` environment variable
3. Update `COUNTY_NAME` for email reports

Example for Shelby County:
```bash
COUNTY_CODE=079
COUNTY_NAME=Shelby
```

## Troubleshooting

### Common Issues

**No results found**
- Verify the date range covers actual sale recordings
- TPAD may have a 1-2 week lag from actual closing to recording

**Email not sending**
- Verify `SENDGRID_API_KEY` is set correctly
- Check SendGrid dashboard for delivery status
- Run `npm start -- --test-email` to verify configuration

**Timeout errors**
- Increase `REQUEST_DELAY_MS` to reduce server load
- Reduce `CONCURRENCY` to 1-2
- Check if TPAD website is accessible

**Selector errors**
- TPAD may have updated their website
- Check `src/config/selectors.ts` and update if needed
- Open an issue with error details

### Debugging

```bash
# Enable debug logging
LOG_LEVEL=debug npm start -- --dry-run

# Run with visible browser (non-headless)
HEADLESS=false npm run dev
```

## Limitations

1. **Recording vs. Closing Date**: TPAD shows recording dates, which typically lag actual closing by 1-2 weeks. Plan your outreach accordingly.

2. **Data Accuracy**: While we filter for arm's-length sales, some family transfers or unusual transactions may slip through or be incorrectly filtered.

3. **Website Changes**: If TPAD updates their website, the scraper selectors may need updating. The selectors are centralized in `src/config/selectors.ts` for easy maintenance.

4. **Rate Limiting**: The scraper includes delays to avoid overloading TPAD servers. Aggressive settings may result in IP blocking.

5. **Owner Mailing Address**: Not all parcel records include mailing addresses. You may need to verify through county records.

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

## Project Structure

```
├── src/
│   ├── index.ts              # CLI entry point
│   ├── config/
│   │   ├── index.ts          # Configuration loader
│   │   └── selectors.ts      # TPAD DOM selectors
│   ├── scraper/
│   │   ├── browser.ts        # Playwright setup
│   │   ├── search.ts         # Search automation
│   │   ├── parcel-details.ts # Detail extraction
│   │   └── tpad-client.ts    # Main orchestrator
│   ├── processors/
│   │   ├── filter.ts         # Arm's-length filtering
│   │   ├── dedupe.ts         # Deduplication
│   │   └── transform.ts      # Data transformation
│   ├── output/
│   │   ├── csv-writer.ts     # CSV output
│   │   ├── json-writer.ts    # JSON output
│   │   └── s3-uploader.ts    # S3 upload (optional)
│   ├── email/
│   │   └── sendgrid.ts       # Email delivery
│   ├── utils/
│   │   ├── date-range.ts     # Date calculations
│   │   ├── logger.ts         # Structured logging
│   │   └── retry.ts          # Retry logic
│   └── types/
│       └── index.ts          # TypeScript interfaces
├── tests/                    # Unit tests
├── .github/workflows/        # GitHub Actions
├── Dockerfile               # Production container
├── docker-compose.yml       # Docker orchestration
└── README.md
```

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

