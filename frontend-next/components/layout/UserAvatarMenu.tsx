"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { Camera, KeyRound, LogOut, Settings, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const MAX_AVATAR_BYTES = 1024 * 1024;

const TEXT = {
  ru: {
    settings: "Настройки",
    logout: "Выйти",
    accountSettings: "Настройки аккаунта",
    accountDescription:
      "Здесь можно обновить пароль и поменять аватарку для текущего пользователя.",
    avatar: "Аватар",
    uploadAvatar: "Загрузить аватар",
    removeAvatar: "Убрать аватар",
    currentPassword: "Текущий пароль",
    newPassword: "Новый пароль",
    confirmPassword: "Подтвердите пароль",
    savePassword: "Обновить пароль",
    passwordUpdated: "Пароль обновлен.",
    saving: "Сохранение...",
    close: "Закрыть",
    avatarSaved: "Аватар сохранен.",
    avatarRemoved: "Аватар удален.",
    avatarTooLarge: "Изображение должно быть не больше 1 МБ.",
    avatarUploadFailed: "Не удалось сохранить аватар.",
    passwordUpdateFailed: "Не удалось обновить пароль.",
  },
  en: {
    settings: "Settings",
    logout: "Log out",
    accountSettings: "Account settings",
    accountDescription:
      "Update the password and change the avatar for the current user.",
    avatar: "Avatar",
    uploadAvatar: "Upload avatar",
    removeAvatar: "Remove avatar",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    savePassword: "Update password",
    passwordUpdated: "Password updated.",
    saving: "Saving...",
    close: "Close",
    avatarSaved: "Avatar saved.",
    avatarRemoved: "Avatar removed.",
    avatarTooLarge: "The image must be 1 MB or smaller.",
    avatarUploadFailed: "Failed to save avatar.",
    passwordUpdateFailed: "Failed to update password.",
  },
} as const;

function getInitials(username?: string | null) {
  if (!username) {
    return "CS";
  }

  return username
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
}

function getErrorDetail(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "detail" in error &&
    typeof error.detail === "string" &&
    error.detail.trim()
  ) {
    return error.detail;
  }

  return fallback;
}

export default function UserAvatarMenu({
  language,
}: {
  language: "ru" | "en";
}) {
  const { user, logout, refreshProfile } = useAuth();
  const text = TEXT[language];
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [openSettings, setOpenSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);

  const initials = useMemo(() => getInitials(user?.username), [user?.username]);

  if (!user) {
    return null;
  }

  const username = user.username;
  const email = user.email;
  const avatarSrc = user.avatar_url ?? null;

  async function handleAvatarSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setSettingsMessage(null);
      setSettingsError(text.avatarTooLarge);
      return;
    }

    try {
      setIsSavingAvatar(true);
      setSettingsError(null);
      setSettingsMessage(null);
      await auth.updateAvatar(file);
      await refreshProfile();
      setSettingsMessage(text.avatarSaved);
    } catch (error) {
      setSettingsMessage(null);
      setSettingsError(getErrorDetail(error, text.avatarUploadFailed));
    } finally {
      setIsSavingAvatar(false);
    }
  }

  async function handleRemoveAvatar() {
    try {
      setIsSavingAvatar(true);
      setSettingsError(null);
      setSettingsMessage(null);
      await auth.removeAvatar();
      await refreshProfile();
      setSettingsMessage(text.avatarRemoved);
    } catch (error) {
      setSettingsMessage(null);
      setSettingsError(getErrorDetail(error, text.avatarUploadFailed));
    } finally {
      setIsSavingAvatar(false);
    }
  }

  async function handlePasswordUpdate() {
    try {
      setIsSavingPassword(true);
      setSettingsError(null);
      setSettingsMessage(null);

      await auth.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSettingsMessage(text.passwordUpdated);
    } catch (error) {
      setSettingsMessage(null);
      setSettingsError(getErrorDetail(error, text.passwordUpdateFailed));
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar>
              <AvatarImage src={avatarSrc ?? undefined} alt={username} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-52" align="end">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{username}</span>
              <span className="text-xs text-muted-foreground">{email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setOpenSettings(true)}>
              <Settings className="size-4" />
              {text.settings}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onClick={logout}>
              <LogOut className="size-4" />
              {text.logout}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={openSettings}
        onOpenChange={(open) => {
          setOpenSettings(open);
          if (!open) {
            setSettingsError(null);
            setSettingsMessage(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{text.accountSettings}</DialogTitle>
            <DialogDescription>{text.accountDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {settingsError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {settingsError}
              </div>
            ) : null}
            {settingsMessage ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                {settingsMessage}
              </div>
            ) : null}

            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarImage src={avatarSrc ?? undefined} alt={username} />
                  <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">{text.avatar}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isSavingAvatar}
                    >
                      <Upload className="size-4" />
                      {isSavingAvatar ? text.saving : text.uploadAvatar}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleRemoveAvatar()}
                      disabled={isSavingAvatar || !avatarSrc}
                    >
                      <Camera className="size-4" />
                      {text.removeAvatar}
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={handleAvatarSelect}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">{text.currentPassword}</label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">{text.newPassword}</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">{text.confirmPassword}</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpenSettings(false)}>
                {text.close}
              </Button>
              <Button
                type="button"
                onClick={() => void handlePasswordUpdate()}
                disabled={isSavingPassword}
              >
                <KeyRound className="size-4" />
                {isSavingPassword ? text.saving : text.savePassword}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
