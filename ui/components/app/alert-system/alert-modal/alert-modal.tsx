import React, { useCallback } from 'react';
import { ButtonVariant } from '@metamask/snaps-sdk';

import { SecurityProvider } from '../../../../../shared/constants/security-provider';
import {
  Box,
  Button,
  ButtonSize,
  Checkbox,
  Icon,
  IconName,
  IconSize,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
} from '../../../component-library';
import {
  AlignItems,
  BackgroundColor,
  BlockSize,
  BorderRadius,
  Display,
  FlexDirection,
  IconColor,
  Severity,
  TextAlign,
  TextColor,
  TextVariant,
} from '../../../../helpers/constants/design-system';
import { useI18nContext } from '../../../../hooks/useI18nContext';
import useAlerts from '../../../../hooks/useAlerts';
import { Alert } from '../../../../ducks/confirm-alerts/confirm-alerts';
import { useAlertActionHandler } from '../contexts/alertActionHandler';
import { AlertProvider } from '../alert-provider';

export type AlertModalProps = {
  /**
   * The unique key representing the specific alert field.
   */
  alertKey: string;
  /**
   * The custom button component for acknowledging the alert.
   */
  customAcknowledgeButton?: React.ReactNode;
  /**
   * The custom checkbox component for acknowledging the alert.
   */
  customAcknowledgeCheckbox?: React.ReactNode;
  /**
   * The custom details component for the alert.
   */
  customDetails?: React.ReactNode;
  /**
   * The custom title for the alert.
   */
  customTitle?: string;
  /**
   * The flag to enable the provider. It's enabled by default.
   */
  enableProvider?: boolean;
  /**
   * The start (left) content area of ModalHeader.
   * It overrides `startAccessory` of ModalHeaderDefault and by default no content is present.
   */
  headerStartAccessory?: React.ReactNode;
  /**
   * The function invoked when the user acknowledges the alert.
   */
  onAcknowledgeClick: () => void;
  /**
   * The function to be executed when the modal needs to be closed.
   */
  onClose: () => void;
  /**
   * The owner ID of the relevant alert from the `confirmAlerts` reducer.
   */
  ownerId: string;
};

function getSeverityStyle(severity?: Severity) {
  switch (severity) {
    case Severity.Warning:
      return {
        background: BackgroundColor.warningMuted,
        icon: IconColor.warningDefault,
      };
    case Severity.Danger:
      return {
        background: BackgroundColor.errorMuted,
        icon: IconColor.errorDefault,
      };
    default:
      return {
        background: BackgroundColor.backgroundDefault,
        icon: IconColor.infoDefault,
      };
  }
}

function AlertHeader({
  selectedAlert,
  customTitle,
}: {
  selectedAlert: Alert;
  customTitle?: string;
}) {
  const t = useI18nContext();
  const { severity, reason } = selectedAlert;
  const severityStyle = getSeverityStyle(severity);
  return (
    <Box
      gap={3}
      display={Display.Block}
      alignItems={AlignItems.center}
      textAlign={TextAlign.Center}
    >
      <Icon
        name={severity === Severity.Info ? IconName.Info : IconName.Danger}
        size={IconSize.Xl}
        color={severityStyle.icon}
      />
      <Text
        variant={TextVariant.headingSm}
        color={TextColor.inherit}
        marginTop={3}
        marginBottom={4}
      >
        {customTitle ?? reason ?? t('alert')}
      </Text>
    </Box>
  );
}

function BlockaidAlertDetails() {
  const t = useI18nContext();
  return (
    <Text textAlign={TextAlign.Center} variant={TextVariant.bodyMd}>
      {t('blockaidAlertInfo')}
    </Text>
  );
}

function AlertDetails({
  selectedAlert,
  customDetails,
}: {
  selectedAlert: Alert;
  customDetails?: React.ReactNode;
}) {
  const t = useI18nContext();
  const severityStyle = getSeverityStyle(selectedAlert.severity);
  return (
    <Box
      key={selectedAlert.key}
      display={Display.InlineBlock}
      padding={2}
      width={BlockSize.Full}
      backgroundColor={customDetails ? undefined : severityStyle.background}
      gap={2}
      borderRadius={BorderRadius.SM}
    >
      {customDetails ?? (
        <Box>
          <Text variant={TextVariant.bodyMd}>{selectedAlert.message}</Text>
          {selectedAlert.alertDetails?.length ? (
            <Text variant={TextVariant.bodyMdBold} marginTop={1}>
              {t('alertModalDetails')}
            </Text>
          ) : null}
          <Box as="ul" className={'alert-modal__alert-details'} paddingLeft={6}>
            {selectedAlert.alertDetails?.map((detail, index) => (
              <Box as="li" key={`${selectedAlert.key}-detail-${index}`}>
                <Text variant={TextVariant.bodyMd}>{detail}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}

export function AcknowledgeCheckboxBase({
  selectedAlert,
  onCheckboxClick,
  isConfirmed,
  label,
}: {
  selectedAlert: Alert;
  onCheckboxClick: () => void;
  isConfirmed: boolean;
  label?: string;
}) {
  if (selectedAlert.isBlocking || selectedAlert.severity !== Severity.Danger) {
    return null;
  }

  const t = useI18nContext();
  const severityStyle = getSeverityStyle(selectedAlert.severity);
  return (
    <Box
      display={Display.Flex}
      padding={3}
      width={BlockSize.Full}
      gap={3}
      backgroundColor={severityStyle.background}
      marginTop={4}
      borderRadius={BorderRadius.LG}
    >
      <Checkbox
        label={label ?? t('alertModalAcknowledge')}
        data-testid={'alert-modal-acknowledge-checkbox'}
        isChecked={isConfirmed}
        onChange={onCheckboxClick}
        alignItems={AlignItems.flexStart}
        className={'alert-modal__acknowledge-checkbox'}
      />
    </Box>
  );
}

function AcknowledgeButton({
  onAcknowledgeClick,
  isConfirmed,
  hasActions,
  isBlocking,
}: {
  onAcknowledgeClick: () => void;
  isConfirmed: boolean;
  hasActions?: boolean;
  isBlocking?: boolean;
}) {
  const t = useI18nContext();

  if (isBlocking) {
    return null;
  }

  return (
    <Button
      variant={hasActions ? ButtonVariant.Secondary : ButtonVariant.Primary}
      width={BlockSize.Full}
      onClick={onAcknowledgeClick}
      size={ButtonSize.Lg}
      data-testid="alert-modal-button"
      disabled={!isConfirmed}
    >
      {t('gotIt')}
    </Button>
  );
}

function ActionButton({ action }: { action?: { key: string; label: string } }) {
  const { processAction } = useAlertActionHandler();

  if (!action) {
    return null;
  }

  const { key, label } = action;

  return (
    <Button
      key={key}
      variant={ButtonVariant.Primary}
      width={BlockSize.Full}
      size={ButtonSize.Lg}
      onClick={() => processAction(key)}
    >
      {label}
    </Button>
  );
}

export function AlertModal({
  ownerId,
  onAcknowledgeClick,
  alertKey,
  onClose,
  headerStartAccessory,
  customTitle,
  customDetails,
  customAcknowledgeCheckbox,
  customAcknowledgeButton,
  enableProvider = true,
}: AlertModalProps) {
  const { isAlertConfirmed, setAlertConfirmed, alerts } = useAlerts(ownerId);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const selectedAlert = alerts.find((alert: Alert) => alert.key === alertKey);

  if (!selectedAlert) {
    return null;
  }
  const isConfirmed = isAlertConfirmed(selectedAlert.key);
  const isAlertDanger = selectedAlert.severity === Severity.Danger;

  const handleCheckboxClick = useCallback(() => {
    return setAlertConfirmed(selectedAlert.key, !isConfirmed);
  }, [isConfirmed, selectedAlert.key]);

  return (
    <Modal isOpen onClose={handleClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader
          onClose={handleClose}
          startAccessory={headerStartAccessory}
          paddingBottom={0}
          display={headerStartAccessory ? Display.InlineFlex : Display.Block}
        />
        <AlertHeader selectedAlert={selectedAlert} customTitle={customTitle} />
        <ModalBody>
          {selectedAlert?.provider === SecurityProvider.Blockaid ? (
            <BlockaidAlertDetails />
          ) : (
            <AlertDetails
              selectedAlert={selectedAlert}
              customDetails={customDetails}
            />
          )}
          {customAcknowledgeCheckbox ?? (
            <AcknowledgeCheckboxBase
              selectedAlert={selectedAlert}
              isConfirmed={isConfirmed}
              onCheckboxClick={handleCheckboxClick}
            />
          )}
          {enableProvider ? (
            <AlertProvider
              provider={selectedAlert.provider}
              paddingTop={2}
              textAlign={TextAlign.Center}
            />
          ) : null}
        </ModalBody>
        <ModalFooter>
          <Box
            display={Display.Flex}
            flexDirection={FlexDirection.Column}
            gap={4}
            width={BlockSize.Full}
          >
            {customAcknowledgeButton ?? (
              <>
                <AcknowledgeButton
                  onAcknowledgeClick={onAcknowledgeClick}
                  isConfirmed={!isAlertDanger || isConfirmed}
                  hasActions={Boolean(selectedAlert.actions)}
                  isBlocking={selectedAlert.isBlocking}
                />
                {(selectedAlert.actions ?? []).map(
                  (action: { key: string; label: string }) => (
                    <ActionButton key={action.key} action={action} />
                  ),
                )}
              </>
            )}
          </Box>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
