import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { useSelector } from 'react-redux';
import NftDefaultImage from '../../app/nft-default-image/nft-default-image';
import {
  AvatarNetwork,
  AvatarNetworkSize,
  BadgeWrapper,
  BadgeWrapperAnchorElementShape,
  Box,
} from '../../component-library';
import {
  BackgroundColor,
  Display,
  JustifyContent,
} from '../../../helpers/constants/design-system';
import {
  getIpfsGateway,
  getOpenSeaEnabled,
  getTestNetworkBackgroundColor,
} from '../../../selectors';

export const NftItem = ({
  alt,
  name,
  src,
  networkName,
  networkSrc,
  tokenId,
  onClick,
  clickable,
  isIpfsURL,
}) => {
  const testNetworkBackgroundColor = useSelector(getTestNetworkBackgroundColor);
  const isIpfsEnabled = useSelector(getIpfsGateway);
  const openSeaEnabled = useSelector(getOpenSeaEnabled);

  const ipfsImageIsRenderable = isIpfsEnabled && isIpfsURL && src;
  const openseaImageIsRenderable = openSeaEnabled && src && !isIpfsURL;

  const nftImageComponentToRender =
    ipfsImageIsRenderable || openseaImageIsRenderable ? (
      <Box
        className="nft-item__item nft-item__item-image"
        data-testid="nft-image"
        as="img"
        src={src}
        alt={alt}
        display={Display.Block}
        justifyContent={JustifyContent.center}
      />
    ) : (
      <NftDefaultImage
        className="nft-item__default-image"
        data-testid="nft-default-image"
        name={name}
        tokenId={tokenId}
        clickable={clickable && isIpfsURL}
      />
    );

  return (
    <Box
      className="nft-item__container"
      data-testid="nft-item"
      as="button"
      onClick={onClick}
    >
      <BadgeWrapper
        className={classnames('nft-item__badge-wrapper', {
          'nft-item__badge-wrapper__clickable': clickable,
        })}
        anchorElementShape={BadgeWrapperAnchorElementShape.circular}
        positionObj={{ top: -4, right: -4 }}
        display={Display.Block}
        badge={
          <AvatarNetwork
            className="nft-item__network-badge"
            backgroundColor={testNetworkBackgroundColor}
            data-testid="nft-network-badge"
            size={AvatarNetworkSize.Sm}
            name={networkName}
            src={networkSrc}
            borderWidth={2}
            borderColor={BackgroundColor.backgroundDefault}
            /* We are using BackgroundColor.backgroundDefault here because
             * there is no equivalent BorderColor to get the "cutout" effect
             */
          />
        }
      >
        {nftImageComponentToRender}
      </BadgeWrapper>
    </Box>
  );
};

NftItem.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  networkName: PropTypes.string.isRequired,
  networkSrc: PropTypes.string.isRequired,
  tokenId: PropTypes.string.isRequired,
  onClick: PropTypes.func,
  clickable: PropTypes.bool,
  isIpfsURL: PropTypes.bool,
};
