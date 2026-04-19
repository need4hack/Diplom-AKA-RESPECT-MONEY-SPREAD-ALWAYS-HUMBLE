"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
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
    avatarSaved: "Аватар сохранен локально для этого пользователя.",
    avatarRemoved: "Аватар удален.",
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
    avatarSaved: "Avatar saved locally for this user.",
    avatarRemoved: "Avatar removed.",
  },
} as const;

function getAvatarStorageKey(userId: string) {
  return `carspecs-avatar:${userId}`;
}

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

export default function UserAvatarMenu({
  language,
}: {
  language: "ru" | "en";
}) {
  const { user, logout } = useAuth();
  const text = TEXT[language];
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [openSettings, setOpenSettings] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    if (!user || typeof window === "undefined") {
      setAvatarSrc(null);
      return;
    }

    const storedAvatar = window.localStorage.getItem(getAvatarStorageKey(user.id));
    setAvatarSrc(storedAvatar);
  }, [user]);

  const initials = useMemo(() => getInitials(user?.username), [user?.username]);

  if (!user) {
    return null;
  }

  const userId = user.id;
  const username = user.username;
  const email = user.email;

  function handleAvatarSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || typeof window === "undefined") {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (!result) {
        return;
      }

      window.localStorage.setItem(getAvatarStorageKey(userId), result);
      setAvatarSrc(result);
      setSettingsError(null);
      setSettingsMessage(text.avatarSaved);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function handleRemoveAvatar() {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.removeItem(getAvatarStorageKey(userId));
    setAvatarSrc(null);
    setSettingsError(null);
    setSettingsMessage(text.avatarRemoved);
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
      const detail =
        typeof error === "object" &&
        error !== null &&
        "detail" in error &&
        typeof error.detail === "string"
          ? error.detail
          : "Failed to update password.";

      setSettingsError(detail);
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
                    >
                      <Upload className="size-4" />
                      {text.uploadAvatar}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemoveAvatar}>
                      <Camera className="size-4" />
                      {text.removeAvatar}
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
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
