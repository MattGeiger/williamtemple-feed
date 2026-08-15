// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger

import * as React from 'react';
import { CalendarClock, Palette } from 'lucide-react';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { SaveIcon } from '@/components/animate-ui/icons/save';
import { SectionHeader } from '@/components/shared/section-header';
import { Settings } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';
import { messageService } from '@/services/message';
import { settingsService } from '@/services/settings';
import {
  DEFAULT_OPERATING_HOURS_SETTINGS,
  type OperatingHoursSettings,
} from '@/types/settings';
import { AppearanceSetting } from './appearance-setting';
import { DAYS, OperatingHoursEditor } from './operating-hours-editor';

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function validationMessage(settings: OperatingHoursSettings): string | null {
  for (const { value, label } of DAYS) {
    const day = settings.hours[value];
    if (!TIME_PATTERN.test(day.openTime) || !TIME_PATTERN.test(day.closeTime)) {
      return `${label} needs a valid opening and closing time.`;
    }
    if (day.isOpen && day.closeTime <= day.openTime) {
      return `${label} closing time must be later than opening time.`;
    }
  }
  return null;
}

export function SettingsWorkspace() {
  const [settings, setSettings] = React.useState<OperatingHoursSettings>(
    DEFAULT_OPERATING_HOURS_SETTINGS
  );
  const [savedSettings, setSavedSettings] = React.useState<OperatingHoursSettings | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [timezoneMismatchOpen, setTimezoneMismatchOpen] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    settingsService.getOperatingHours()
      .then((loaded) => {
        if (!active) return;
        setSettings(loaded);
        setSavedSettings(loaded);
      })
      .catch((error) => ErrorHandlerService.handleError(error, 'settingsLoadOperatingHours'))
      .finally(() => active && setIsLoading(false));
    return () => { active = false; };
  }, []);

  const save = async () => {
    const invalid = validationMessage(settings);
    if (invalid) {
      messageService.error(invalid);
      return;
    }

    try {
      setIsSaving(true);
      const saved = await settingsService.updateOperatingHours({
        timezone: settings.timezone,
        hours: settings.hours,
      });
      setSettings(saved);
      setSavedSettings(saved);
      messageService.success(
        'Operating hours saved for everyone using FEED, effective today.'
      );
    } catch (error) {
      ErrorHandlerService.handleError(error, 'settingsSaveOperatingHours');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (deviceTimezone && deviceTimezone !== settings.timezone) {
      setTimezoneMismatchOpen(true);
      return;
    }
    void save();
  };

  const hasChanges = savedSettings !== null &&
    JSON.stringify({ timezone: settings.timezone, hours: settings.hours }) !==
    JSON.stringify({ timezone: savedSettings.timezone, hours: savedSettings.hours });
  const disabled = isLoading || isSaving;

  return (
    <div className="space-y-6 min-w-0 w-full pt-6">
      <SectionHeader
        icon={Settings}
        title="Settings"
        description="Organization-wide settings shared by everyone using FEED."
      />

      <section
        aria-labelledby="operating-hours-heading"
        className="max-w-4xl space-y-4"
      >
        <div className="space-y-1.5">
          <h3
            id="operating-hours-heading"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <CalendarClock className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Operating Hours
          </h3>
          <p className="text-sm text-muted-foreground">
            Choose the pantry's recurring service days, hours, and timezone. Analytics uses this schedule to compare recorded availability during client service hours.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3" aria-label="Loading operating hours">
            <Skeleton className="h-9 w-full max-w-md" />
            {DAYS.map(({ value }) => <Skeleton key={value} className="h-16 w-full" />)}
          </div>
        ) : (
          <OperatingHoursEditor
            hours={settings.hours}
            timezone={settings.timezone}
            onChange={(hours) => setSettings((current) => ({ ...current, hours }))}
            onTimezoneChange={(timezone) => setSettings((current) => ({ ...current, timezone }))}
            disabled={disabled}
          />
        )}

        <AnimateIcon asChild animateOnHover animateOnTap>
          <Button onClick={handleSave} disabled={disabled || !hasChanges}>
            <SaveIcon size={16} />
            {isSaving ? 'Saving…' : 'Save Operating Hours'}
          </Button>
        </AnimateIcon>
      </section>

      <section
        aria-labelledby="appearance-heading"
        className="max-w-4xl space-y-4"
      >
        <div className="space-y-1.5">
          <h3
            id="appearance-heading"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <Palette className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            Appearance
          </h3>
          <p className="text-sm text-muted-foreground">
            Choose how FEED looks on <strong>this device only</strong>. Unlike the
            settings above, this is not shared — it is saved in this browser, so
            everyone can read FEED the way that suits them. The theme button in the
            header switches between light and dark; choose Follow this device to let
            your computer decide.
          </p>
        </div>

        <AppearanceSetting />
      </section>

      <AlertDialog open={timezoneMismatchOpen} onOpenChange={setTimezoneMismatchOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm timezone selection</AlertDialogTitle>
            <AlertDialogDescription>
              Your device timezone does not match the pantry timezone. Reports should use the timezone where pantry services take place. Continue anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving}
              onClick={() => {
                setTimezoneMismatchOpen(false);
                void save();
              }}
            >
              Continue and Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
