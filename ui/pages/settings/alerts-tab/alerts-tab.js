import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';

import { ALERT_TYPES } from '../../../../shared/constants/alerts';
import Tooltip from '../../../components/ui/tooltip';
import ToggleButton from '../../../components/ui/toggle-button';
import { setAlertEnabledness } from '../../../store/actions';
import { getAlertEnabledness } from '../../../ducks/metamask/metamask';
import { useI18nContext } from '../../../hooks/useI18nContext';
import { handleHooksSettingsRefs } from '../../../helpers/utils/settings-search';

const AlertSettingsEntry = ({ alertId, description, title, alertIndex }) => {
  const t = useI18nContext();
  const settingsRefs = useRef(alertIndex);

  useEffect(() => {
    handleHooksSettingsRefs(t, t('alerts'), settingsRefs, alertIndex);
  }, [settingsRefs, t, alertIndex]);

  const isEnabled = useSelector((state) => getAlertEnabledness(state)[alertId]);

  return (
    <>
      <div ref={settingsRefs} className="alerts-tab__item">
        <span>{title}</span>
        <div className="alerts-tab__description-container">
          <Tooltip
            position="top"
            title={description}
            wrapperClassName="alerts-tab__description"
          >
            <i className="fa fa-info-circle" />
          </Tooltip>
          <ToggleButton
            offLabel={t('off')}
            onLabel={t('on')}
            onToggle={() => setAlertEnabledness(alertId, !isEnabled)}
            value={isEnabled}
          />
        </div>
      </div>
    </>
  );
};

AlertSettingsEntry.propTypes = {
  alertId: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  alertIndex: PropTypes.number.isRequired,
};

const AlertsTab = () => {
  const t = useI18nContext();

  const alertConfig = {
    [ALERT_TYPES.unconnectedAccount]: {
      title: t('alertSettingsUnconnectedAccount'),
      description: t('alertSettingsUnconnectedAccountDescription'),
    },
    [ALERT_TYPES.web3ShimUsage]: {
      title: t('alertSettingsWeb3ShimUsage'),
      description: t('alertSettingsWeb3ShimUsageDescription'),
    },
  };

  return (
    <div className="alerts-tab__body">
      {Object.entries(alertConfig).map(
        ([alertId, { title, description }], index) => (
          <AlertSettingsEntry
            alertId={alertId}
            description={description}
            key={alertId}
            title={title}
            alertIndex={index}
          />
        ),
      )}
    </div>
  );
};

export default AlertsTab;
