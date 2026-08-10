import React, { useEffect, useState } from "react";
import { Group, Text, ScrollArea, ActionIcon, Tooltip } from "@mantine/core";
import {
  IconUser,
  IconSettings,
  IconUsers,
  IconArrowLeft,
  IconUsersGroup,
  IconSpaces,
  IconBrush,
  IconCoin,
  IconLock,
  IconKey,
  IconWorld,
  IconSparkles,
  IconHistory,
  IconShieldCheck,
  IconShieldLock,
} from "@tabler/icons-react";
import { Link, useLocation } from "react-router-dom";
import classes from "./settings.module.css";
import { useTranslation } from "react-i18next";
import { isCloud } from "@/lib/config.ts";
import useUserRole from "@/hooks/use-user-role.tsx";
import { useAtom } from "jotai";
import { entitlementAtom } from "@/ee/entitlement/entitlement-atom";
import { Feature } from "@/ee/features";
import { hideLockedEeItems } from "@/custom-sso/ui-flags";
import { useUpgradeLabel } from "@/ee/hooks/use-upgrade-label";
import {
  prefetchApiKeyManagement,
  prefetchApiKeys,
  prefetchBilling,
  prefetchGroups,
  prefetchLicense,
  prefetchScimTokens,
  prefetchShares,
  prefetchSpaces,
  prefetchSsoProviders,
  prefetchWorkspaceMembers,
  prefetchAuditLogs,
  prefetchVerifiedPages,
} from "@/components/settings/settings-queries.tsx";
import AppVersion from "@/components/settings/app-version.tsx";
import { mobileSidebarAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom.ts";
import { useToggleSidebar } from "@/components/layouts/global/hooks/hooks/use-toggle-sidebar.ts";
import { useSettingsNavigation } from "@/hooks/use-settings-navigation";

type DataItem = {
  label: string;
  icon: React.ElementType;
  path: string;
  feature?: string;
  role?: "admin" | "owner";
  env?: "cloud" | "selfhosted";
};

type DataGroup = {
  heading: string;
  items: DataItem[];
};

const groupedData: DataGroup[] = [
  {
    heading: "Account",
    items: [
      { label: "Profile", icon: IconUser, path: "/settings/account/profile" },
      {
        label: "Preferences",
        icon: IconBrush,
        path: "/settings/account/preferences",
      },
      {
        label: "API keys",
        icon: IconKey,
        path: "/settings/account/api-keys",
        feature: Feature.API_KEYS,
      },
      // Наши персональные токены — без feature-гейта, доступны всем.
      {
        label: "API tokens",
        icon: IconKey,
        path: "/settings/account/api-tokens",
      },
    ],
  },
  {
    heading: "Workspace",
    items: [
      { label: "General", icon: IconSettings, path: "/settings/workspace" },
      { label: "Members", icon: IconUsers, path: "/settings/members" },
      {
        label: "Billing",
        icon: IconCoin,
        path: "/settings/billing",
        role: "admin",
        env: "cloud",
      },
      {
        label: "Security & SSO",
        icon: IconLock,
        path: "/settings/security",
        feature: Feature.SECURITY_SETTINGS,
        role: "admin",
      },
      // Наш собственный SSO — не за лицензией, поэтому без feature-гейта.
      {
        label: "Keycloak SSO",
        icon: IconShieldLock,
        path: "/settings/keycloak",
        role: "admin",
      },
      // Оформление интерфейса: общее для всех, меняет администратор.
      {
        label: "Appearance",
        icon: IconBrush,
        path: "/settings/appearance",
        role: "admin",
      },
      { label: "Groups", icon: IconUsersGroup, path: "/settings/groups" },
      { label: "Spaces", icon: IconSpaces, path: "/settings/spaces" },
      { label: "Public sharing", icon: IconWorld, path: "/settings/sharing" },
      {
        label: "Verified pages",
        icon: IconShieldCheck,
        path: "/settings/verifications",
        feature: Feature.PAGE_VERIFICATION,
      },
      {
        label: "API management",
        icon: IconKey,
        path: "/settings/api-keys",
        feature: Feature.API_KEYS,
        role: "admin",
      },
      {
        label: "AI settings",
        icon: IconSparkles,
        path: "/settings/ai",
        feature: Feature.AI,
        role: "admin",
      },
      {
        label: "Audit log",
        icon: IconHistory,
        path: "/settings/audit",
        feature: Feature.AUDIT_LOGS,
        role: "owner",
        env: "selfhosted",
      },
    ],
  },
  {
    heading: "System",
    items: [
      {
        label: "License & Edition",
        icon: IconKey,
        path: "/settings/license",
      },
    ],
  },
];

// Видно ли раздел этому пользователю. Вынесено из компонента, чтобы тем
// же правилом пользовалась свёрнутая полоса.
function canShowSettingsItem(
  item: DataItem,
  perm: { isAdmin: boolean; isOwner: boolean },
) {
  if (item.env === "cloud" && !isCloud()) return false;
  if (item.env === "selfhosted" && isCloud()) return false;
  if (item.role === "admin" && !perm.isAdmin) return false;
  if (item.role === "owner" && !perm.isOwner) return false;
  return true;
}

// Плоский список разделов для свёрнутой полосы — без заголовков групп,
// в том же порядке и с теми же правилами видимости.
export function useSettingsRailItems(): DataItem[] {
  const { isAdmin, isOwner } = useUserRole();

  return groupedData.flatMap((group) => {
    // Раздел System — это только «License & Edition»; прячем его там же,
    // где и в развёрнутом виде.
    if (
      group.heading === "System" &&
      (!isAdmin || isCloud() || hideLockedEeItems())
    ) {
      return [];
    }
    return group.items.filter((item) =>
      canShowSettingsItem(item, { isAdmin, isOwner }),
    );
  });
}

export default function SettingsSidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const [active, setActive] = useState(location.pathname);
  const { goBack } = useSettingsNavigation();
  const { isAdmin, isOwner } = useUserRole();
  const [entitlements] = useAtom(entitlementAtom);
  const upgradeLabel = useUpgradeLabel();
  const [mobileSidebarOpened] = useAtom(mobileSidebarAtom);
  const toggleMobileSidebar = useToggleSidebar(mobileSidebarAtom);

  useEffect(() => {
    setActive(location.pathname);
  }, [location.pathname]);

  const hasFeature = (f: string) =>
    entitlements?.features?.includes(f) ?? false;

  const canShowItem = (item: DataItem) =>
    canShowSettingsItem(item, { isAdmin, isOwner });

  const isItemDisabled = (item: DataItem) => {
    if (!item.feature) return false;
    return !hasFeature(item.feature);
  };

  const menuItems = groupedData.map((group) => {
    // Раздел System — это только "License & Edition" (активация платной
    // лицензии). Прячем вместе с остальным ee, если включён флаг.
    if (
      group.heading === "System" &&
      (!isAdmin || isCloud() || hideLockedEeItems())
    ) {
      return null;
    }

    return (
      <div key={group.heading}>
        <Text c="dimmed" className={classes.linkHeader}>
          {t(group.heading)}
        </Text>
        {group.items.map((item) => {
          if (!canShowItem(item)) {
            return null;
          }

          let prefetchHandler: any;
          switch (item.label) {
            case "Members":
              prefetchHandler = prefetchWorkspaceMembers;
              break;
            case "Spaces":
              prefetchHandler = prefetchSpaces;
              break;
            case "Groups":
              prefetchHandler = prefetchGroups;
              break;
            case "Billing":
              prefetchHandler = prefetchBilling;
              break;
            case "License & Edition":
              if (entitlements?.tier !== "free") {
                prefetchHandler = prefetchLicense;
              }
              break;
            case "Security & SSO":
              prefetchHandler = () => {
                prefetchSsoProviders();
                prefetchScimTokens();
              };
              break;
            case "Public sharing":
              prefetchHandler = prefetchShares;
              break;
            case "API keys":
              prefetchHandler = prefetchApiKeys;
              break;
            case "API management":
              prefetchHandler = prefetchApiKeyManagement;
              break;
            case "Audit log":
              prefetchHandler = prefetchAuditLogs;
              break;
            case "Verified pages":
              prefetchHandler = prefetchVerifiedPages;
              break;
            default:
              break;
          }

          const isDisabled = isItemDisabled(item);

          if (isDisabled) {
            // Штатно Docmost рисует серый пункт с тултипом про лицензию.
            // Нам такие пункты не нужны — убираем совсем.
            if (hideLockedEeItems()) {
              return null;
            }
            return (
              <Tooltip
                key={item.label}
                label={upgradeLabel}
                position="right"
                withArrow
              >
                <span
                  className={classes.link}
                  data-disabled
                  role="link"
                  aria-disabled="true"
                  tabIndex={0}
                  style={{
                    opacity: 0.5,
                    cursor: "not-allowed",
                  }}
                >
                  <item.icon className={classes.linkIcon} stroke={2} />
                  <span>{t(item.label)}</span>
                </span>
              </Tooltip>
            );
          }

          return (
            <Link
              onMouseEnter={prefetchHandler}
              className={classes.link}
              data-active={active.startsWith(item.path) || undefined}
              key={item.label}
              to={item.path}
              onClick={() => {
                if (mobileSidebarOpened) {
                  toggleMobileSidebar();
                }
              }}
            >
              <item.icon className={classes.linkIcon} stroke={2} />
              <span>{t(item.label)}</span>
            </Link>
          );
        })}
      </div>
    );
  });

  return (
    <div className={classes.navbar}>
      {/* Строки «← Настройки» здесь нет: назад ведёт плашка с названием
          фирмы наверху панели, а заголовок дублировал содержимое. */}

      <ScrollArea w="100%">{menuItems}</ScrollArea>

      {!isCloud() && <AppVersion />}

      {isCloud() && (
        <div className={classes.text}>
          <Text
            size="sm"
            c="dimmed"
            component="a"
            href="mailto:help@docmost.com"
          >
            help@docmost.com
          </Text>
        </div>
      )}
    </div>
  );
}
