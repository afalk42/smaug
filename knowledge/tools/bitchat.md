---
title: "bitchat"
type: tool
date_added: 2025-07-06
source: "https://github.com/permissionlesstech/bitchat"
tags: ["messaging", "mesh-network", "peer-to-peer", "Bluetooth", "Nostr", "Coding"]
via: "Twitter bookmark from @jack"
---

A decentralized peer-to-peer messaging app with dual transport architecture combining Bluetooth mesh networks for offline communication and Nostr protocol for global reach. Built with IRC-style commands and end-to-end encryption.

## Key Features

- **Dual Transport Architecture**: Bluetooth mesh for offline + Nostr protocol for internet-based messaging
- **Location-Based Channels**: Geographic chat rooms using geohash coordinates over global Nostr relays
- **Intelligent Message Routing**: Automatically chooses best transport (Bluetooth → Nostr fallback)
- **Decentralized Mesh Network**: Automatic peer discovery and multi-hop message relay over Bluetooth LE
- **Privacy First**: No accounts, no phone numbers, no persistent identifiers
- **Private Message End-to-End Encryption**: Noise Protocol for mesh, NIP-17 for Nostr
- **IRC-Style Commands**: Familiar `/slap`, `/msg`, `/who` style interface
- **Universal App**: Native support for iOS and macOS
- **Emergency Wipe**: Triple-tap to instantly clear all data

## Technical Details

Built in Swift with Bluetooth LE mesh networking for local communication (up to 7 hops) and integration with Nostr protocol for global reach across 290+ relay network. Implements Noise Protocol for identity and encryption on mesh network and NIP-17 gift-wrapping for Nostr private messages.

## Links

- [GitHub](https://github.com/permissionlesstech/bitchat)
- [App Store](https://apps.apple.com/us/app/bitchat-mesh/id6748219622)
- [Website](http://bitchat.free)
- [Original Tweet](https://x.com/jack/status/1941989435962212728)
