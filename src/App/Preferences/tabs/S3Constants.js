// Storage provider options
export const STORAGE_PROVIDERS = [
    { id: 'aws_s3', label: 'Amazon S3', hasEndpoint: false },
    { id: 'wasabi', label: 'Wasabi', hasEndpoint: false },
    { id: 'minio', label: 'MinIO', hasEndpoint: true },
    { id: 'cloudflare_r2', label: 'Cloudflare R2', hasEndpoint: true },
    { id: 'digitalocean', label: 'DigitalOcean Spaces', hasEndpoint: false },
    { id: 'idrive_e2', label: 'iDrive e2', hasEndpoint: false },
    { id: 'custom', label: 'Other (Custom Endpoint)', hasEndpoint: true }
];

// Common AWS regions
// Source: https://docs.aws.amazon.com/general/latest/gr/s3.html
export const AWS_REGIONS = [
    { id: 'us-east-1', label: 'US East (N. Virginia)' },
    { id: 'us-east-2', label: 'US East (Ohio)' },
    { id: 'us-west-1', label: 'US West (N. California)' },
    { id: 'us-west-2', label: 'US West (Oregon)' },
    { id: 'eu-west-1', label: 'EU (Ireland)' },
    { id: 'eu-west-2', label: 'EU (London)' },
    { id: 'eu-central-1', label: 'EU (Frankfurt)' },
    { id: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
    { id: 'ap-northeast-2', label: 'Asia Pacific (Seoul)' },
    { id: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
    { id: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
    { id: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
    { id: 'sa-east-1', label: 'South America (São Paulo)' }
];

// Wasabi regions (15 regions as of 2026)
// Source: https://docs.wasabi.com/docs/service-urls-for-wasabis-storage-regions
// Source: https://wasabi.com/company/storage-regions
export const WASABI_REGIONS = [
    { id: 'us-east-1', label: 'US East (N. Virginia)' },
    { id: 'us-east-2', label: 'US East (N. Virginia-2)' },
    { id: 'us-central-1', label: 'US Central (Texas)' },
    { id: 'us-west-2', label: 'US West (San Jose)' },
    { id: 'ca-central-1', label: 'Canada (Toronto)' },
    { id: 'eu-central-1', label: 'EU Central (Amsterdam)' },
    { id: 'eu-central-2', label: 'EU Central (Frankfurt)' },
    { id: 'eu-west-1', label: 'EU West (London)' },
    { id: 'eu-west-2', label: 'EU West (Paris)' },
    { id: 'eu-west-3', label: 'EU West (London-2)' },
    { id: 'eu-south-1', label: 'EU South (Milan)' },
    { id: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
    { id: 'ap-northeast-2', label: 'Asia Pacific (Osaka)' },
    { id: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
    { id: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' }
];

// DigitalOcean Spaces regions (13 regions as of 2026)
// Source: https://docs.digitalocean.com/products/spaces/details/availability/
export const DIGITALOCEAN_REGIONS = [
    { id: 'nyc1', label: 'New York 1' },
    { id: 'nyc2', label: 'New York 2' },
    { id: 'nyc3', label: 'New York 3' },
    { id: 'sfo2', label: 'San Francisco 2' },
    { id: 'sfo3', label: 'San Francisco 3' },
    { id: 'ams3', label: 'Amsterdam 3' },
    { id: 'sgp1', label: 'Singapore 1' },
    { id: 'lon1', label: 'London 1' },
    { id: 'fra1', label: 'Frankfurt 1' },
    { id: 'tor1', label: 'Toronto 1' },
    { id: 'blr1', label: 'Bangalore 1' },
    { id: 'syd1', label: 'Sydney 1' },
    { id: 'atl1', label: 'Atlanta 1' }
];

// iDrive e2 regions (16 regions as of 2026)
// Source: https://www.idrive.com/s3-storage-e2/e2-endpoint-urls
// Source: https://www.idrive.com/s3-storage-e2/locations
export const IDRIVE_E2_REGIONS = [
    { id: 'us-east-1', label: 'US East (Virginia)' },
    { id: 'us-southeast-1', label: 'US Southeast (Miami)' },
    { id: 'us-central-1', label: 'US Central (Dallas)' },
    { id: 'us-midwest-1', label: 'US Midwest (Chicago)' },
    { id: 'us-southwest-1', label: 'US Southwest (Phoenix)' },
    { id: 'us-west-1', label: 'US West (Oregon)' },
    { id: 'us-west-2', label: 'US West (Los Angeles)' },
    { id: 'us-west-3', label: 'US West (San Jose)' },
    { id: 'ca-east-1', label: 'Canada (Montreal)' },
    { id: 'eu-west-1', label: 'EU West (Ireland)' },
    { id: 'eu-west-2', label: 'EU West (London)' },
    { id: 'eu-west-3', label: 'EU West (London-2)' },
    { id: 'eu-west-4', label: 'EU West (Paris)' },
    { id: 'eu-central-1', label: 'EU Central (Frankfurt-2)' },
    { id: 'eu-central-2', label: 'EU Central (Frankfurt)' },
    { id: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' }
];

// Max file size options
export const MAX_FILE_SIZE_OPTIONS = [
    { value: null, label: 'No limit' },
    { value: 50, label: '50 MB' },
    { value: 100, label: '100 MB' },
    { value: 200, label: '200 MB' },
    { value: 500, label: '500 MB' }
];

// Helper function to get regions for a storage type
export function getRegionsForStorageType(storageType) {
    switch (storageType) {
        case 'aws_s3':
            return AWS_REGIONS;
        case 'wasabi':
            return WASABI_REGIONS;
        case 'digitalocean':
            return DIGITALOCEAN_REGIONS;
        case 'idrive_e2':
            return IDRIVE_E2_REGIONS;
        default:
            // MinIO, Cloudflare R2, Custom use AWS region codes
            return AWS_REGIONS;
    }
}

// Helper functions to parse and build bucket URI
export function parseBucketUri(bucketUri) {
    if (!bucketUri || !bucketUri.startsWith('s3://')) {
        return { bucketName: '', prefix: '' };
    }

    const path = bucketUri.replace('s3://', '');
    const parts = path.split('/');
    const bucketName = parts[0] || '';
    const prefix = parts.slice(1).filter(p => p).join('/');

    return { bucketName, prefix };
}

export function buildBucketUri(bucketName, prefix) {
    if (!bucketName) return '';

    const cleanPrefix = prefix ? prefix.replace(/^\/+|\/+$/g, '') : '';
    return cleanPrefix ? `s3://${bucketName}/${cleanPrefix}/` : `s3://${bucketName}/`;
}
