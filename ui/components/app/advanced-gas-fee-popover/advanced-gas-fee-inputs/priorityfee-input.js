import React, { useState } from 'react';
import { useSelector } from 'react-redux';

import { PRIORITY_LEVELS } from '../../../../../shared/constants/gas';
import { SECONDARY } from '../../../../helpers/constants/common';
import { decGWEIToHexWEI } from '../../../../helpers/utils/conversions.util';
import { getAdvancedGasFeeValues } from '../../../../selectors';
import { useCurrencyDisplay } from '../../../../hooks/useCurrencyDisplay';
import { useGasFeeContext } from '../../../../contexts/gasFee';
import { useI18nContext } from '../../../../hooks/useI18nContext';
import { useUserPreferencedCurrency } from '../../../../hooks/useUserPreferencedCurrency';
import FormField from '../../../ui/form-field';

import AdvancedGasFeeInputSubtext from '../advanced-gas-fee-input-subtext';

const PriorityFeeInput = () => {
  const t = useI18nContext();
  const advancedGasFeeValues = useSelector(getAdvancedGasFeeValues);

  const { estimateUsed, maxPriorityFeePerGas } = useGasFeeContext();

  const [priorityFee, setPriorityFee] = useState(() => {
    if (
      estimateUsed !== PRIORITY_LEVELS.CUSTOM &&
      advancedGasFeeValues?.priorityFee
    )
      return advancedGasFeeValues.priorityFee;
    return maxPriorityFeePerGas;
  });

  const { currency, numberOfDecimals } = useUserPreferencedCurrency(SECONDARY);

  const [, { value: priorityFeeInFiat }] = useCurrencyDisplay(
    decGWEIToHexWEI(priorityFee),
    { currency, numberOfDecimals },
  );

  return (
    <FormField
      onChange={setPriorityFee}
      titleText={t('priorityFee')}
      titleUnit="(GWEI)"
      tooltipText={t('advancedPriorityFeeToolTip')}
      value={priorityFee}
      detailText={`≈ ${priorityFeeInFiat}`}
      numeric
      inputDetails={
        <AdvancedGasFeeInputSubtext
          latest="1-18 GWEI"
          historical="23-359 GWEI"
        />
      }
    />
  );
};

export default PriorityFeeInput;
