# PhotoClove Privacy Policy

Last Updated: January 22, 2025

## Introduction

PhotoClove ("we", "our", or "the app") is committed to protecting your privacy. This Privacy Policy explains how we handle information when you use PhotoClove, particularly regarding the Google Photos integration feature.

## Information We Collect and How We Use It

### Local Application Data

PhotoClove is primarily a local application that:
- Stores photo metadata in a local SQLite database on your device
- Saves application preferences and settings locally
- Does not transmit your photos or personal data to any external servers (except as described below for Google Photos uploads)

### Google Photos Integration

When you choose to use the Google Photos upload feature:

1. **Authentication Process**
   - We use Google OAuth 2.0 for authentication
   - The authentication flow redirects you to rwds.net, which acts solely as an OAuth relay service
   - rwds.net is used to handle authentication processing securely

2. **What rwds.net Does**
   - Acts as an intermediary for the OAuth authentication flow
   - **Does NOT store any user information**
   - **Does NOT retain access tokens or refresh tokens**
   - **Does NOT log or track user activities**
   - Standard web server access logs (including IP addresses) may be temporarily retained for technical operations
   - Simply facilitates the secure exchange of authentication tokens between Google and PhotoClove

3. **What Information is Accessed**
   - Access to upload photos to your Google Photos library
   - Access to create and manage albums in your Google Photos

4. **Token Storage**
   - OAuth tokens are stored **locally on your device only**
   - Tokens are encrypted before storage
   - No tokens or credentials are sent to or stored on rwds.net or any other external server

## Data Storage and Security

### Local Storage
- All application data is stored locally on your device
- Photo metadata, preferences, and OAuth tokens are kept in local databases
- We do not have access to your local data

### Data Transmission
- Photos are uploaded directly from your device to Google Photos
- Only during Google OAuth authentication is there interaction with rwds.net
- No user data is transmitted to or stored on rwds.net

## Third-Party Services

### Google Photos API
- We use Google Photos API in accordance with Google's API Services User Data Policy
- PhotoClove only requests the minimum necessary permissions to upload photos and manage albums
- You can revoke access at any time through your Google Account settings

### rwds.net OAuth Relay
- Operated independently to provide OAuth relay services
- Does not collect, store, or process any user information
- Used solely to protect OAuth credentials from being exposed in the application code

## Your Rights and Choices

You have the right to:
- Use PhotoClove without connecting to Google Photos
- Revoke Google Photos access at any time through the app settings
- Delete all local data by uninstalling the application
- Review and manage your Google permissions at https://myaccount.google.com/permissions

## Data Retention

- **Local Data**: Retained until you delete it or uninstall the application
- **rwds.net**: No data retention - the service does not store any user information
- **Google Photos**: Photos uploaded to Google Photos are subject to Google's privacy policy and retention policies

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time. We will notify you of any changes by updating the "Last Updated" date at the top of this policy.

## Open Source

PhotoClove is open source software. You can review our code at: https://github.com/ktat/photoclove

## Contact Information

If you have any questions about this Privacy Policy or PhotoClove's privacy practices, please:
- Open an issue on our GitHub repository: https://github.com/ktat/photoclove/issues
- Email: photoclove@gmail.com

## Summary

- **PhotoClove** stores all data locally on your device
- **rwds.net** is used only for OAuth authentication and stores NO user data
- **Google Photos** integration is optional and you control what gets uploaded
- **Your privacy** is protected by keeping all sensitive data on your device