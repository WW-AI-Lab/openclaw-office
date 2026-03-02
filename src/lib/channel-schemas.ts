import type { ChannelType } from "@/gateway/adapter-types";

export interface ChannelFieldDef {
  key: string;
  labelKey: string;
  type: "text" | "secret" | "select" | "textarea";
  required: boolean;
  placeholderKey: string;
  options?: Array<{ value: string; labelKey: string }>;
}

export interface ChannelSchema {
  type: ChannelType;
  nameKey: string;
  icon: string;
  fields: ChannelFieldDef[];
  hasQrFlow?: boolean;
}

export const CHANNEL_SCHEMAS: Record<ChannelType, ChannelSchema> = {
  telegram: {
    type: "telegram",
    nameKey: "console:channels.types.telegram",
    icon: "✈️",
    fields: [
      {
        key: "botToken",
        labelKey: "console:channels.fields.botToken",
        type: "secret",
        required: true,
        placeholderKey: "console:channels.placeholders.botToken",
      },
    ],
  },
  discord: {
    type: "discord",
    nameKey: "console:channels.types.discord",
    icon: "🎮",
    fields: [
      {
        key: "botToken",
        labelKey: "console:channels.fields.botToken",
        type: "secret",
        required: true,
        placeholderKey: "console:channels.placeholders.botToken",
      },
      {
        key: "applicationId",
        labelKey: "console:channels.fields.applicationId",
        type: "text",
        required: true,
        placeholderKey: "console:channels.placeholders.applicationId",
      },
    ],
  },
  whatsapp: {
    type: "whatsapp",
    nameKey: "console:channels.types.whatsapp",
    icon: "📱",
    fields: [],
    hasQrFlow: true,
  },
  signal: {
    type: "signal",
    nameKey: "console:channels.types.signal",
    icon: "🔒",
    fields: [
      {
        key: "phoneNumber",
        labelKey: "console:channels.fields.phoneNumber",
        type: "text",
        required: true,
        placeholderKey: "console:channels.placeholders.phoneNumber",
      },
    ],
  },
  feishu: {
    type: "feishu",
    nameKey: "console:channels.types.feishu",
    icon: "🐦",
    fields: [
      {
        key: "appId",
        labelKey: "console:channels.fields.appId",
        type: "text",
        required: true,
        placeholderKey: "console:channels.placeholders.appId",
      },
      {
        key: "appSecret",
        labelKey: "console:channels.fields.appSecret",
        type: "secret",
        required: true,
        placeholderKey: "console:channels.placeholders.appSecret",
      },
    ],
  },
  imessage: {
    type: "imessage",
    nameKey: "console:channels.types.imessage",
    icon: "💬",
    fields: [],
  },
  matrix: {
    type: "matrix",
    nameKey: "console:channels.types.matrix",
    icon: "🔗",
    fields: [
      {
        key: "homeserver",
        labelKey: "console:channels.fields.homeserver",
        type: "text",
        required: true,
        placeholderKey: "console:channels.placeholders.homeserver",
      },
      {
        key: "accessToken",
        labelKey: "console:channels.fields.accessToken",
        type: "secret",
        required: true,
        placeholderKey: "console:channels.placeholders.accessToken",
      },
    ],
  },
  line: {
    type: "line",
    nameKey: "console:channels.types.line",
    icon: "🟢",
    fields: [
      {
        key: "channelAccessToken",
        labelKey: "console:channels.fields.channelAccessToken",
        type: "secret",
        required: true,
        placeholderKey: "console:channels.placeholders.channelAccessToken",
      },
      {
        key: "channelSecret",
        labelKey: "console:channels.fields.channelSecret",
        type: "secret",
        required: true,
        placeholderKey: "console:channels.placeholders.channelSecret",
      },
    ],
  },
  msteams: {
    type: "msteams",
    nameKey: "console:channels.types.msteams",
    icon: "👔",
    fields: [
      {
        key: "appId",
        labelKey: "console:channels.fields.appId",
        type: "text",
        required: true,
        placeholderKey: "console:channels.placeholders.appId",
      },
      {
        key: "appPassword",
        labelKey: "console:channels.fields.appPassword",
        type: "secret",
        required: true,
        placeholderKey: "console:channels.placeholders.appPassword",
      },
    ],
  },
  googlechat: {
    type: "googlechat",
    nameKey: "console:channels.types.googlechat",
    icon: "💭",
    fields: [
      {
        key: "serviceAccountJson",
        labelKey: "console:channels.fields.serviceAccount",
        type: "textarea",
        required: true,
        placeholderKey: "console:channels.placeholders.serviceAccount",
      },
    ],
  },
  mattermost: {
    type: "mattermost",
    nameKey: "console:channels.types.mattermost",
    icon: "💠",
    fields: [
      {
        key: "serverUrl",
        labelKey: "console:channels.fields.serverUrl",
        type: "text",
        required: true,
        placeholderKey: "console:channels.placeholders.serverUrl",
      },
      {
        key: "botToken",
        labelKey: "console:channels.fields.botToken",
        type: "secret",
        required: true,
        placeholderKey: "console:channels.placeholders.botToken",
      },
    ],
  },
};

export const ALL_CHANNEL_TYPES = Object.keys(CHANNEL_SCHEMAS) as ChannelType[];
