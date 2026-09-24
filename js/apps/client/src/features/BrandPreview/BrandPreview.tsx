import { useEffect, useState } from 'react';

import { builderTips } from './BrandPreview.data';
import {
    Root,
    StyledBrand,
    StyledBrandName,
    StyledBullet,
    StyledCarousel,
    StyledDescription,
    StyledImage,
    StyledLogo,
    StyledPagination,
    StyledShade,
    StyledTip,
    StyledTopic,
    StyledTitle,
} from './BrandPreview.styles';

const ROTATE_INTERVAL = 8_000;

const assetsBase = `${import.meta.env.BASE_URL}auth`;

const brandPreviewImage = `${assetsBase}/brand-preview.png`;
const sddsLogo = `${assetsBase}/sdds-logo.svg`;

interface BrandPreviewProps {
    className?: string;
}

export const BrandPreview = ({ className }: BrandPreviewProps) => {
    const [index, setIndex] = useState(() => Math.floor(Math.random() * builderTips.length));
    const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

    const goTo = (nextIndex: number) => {
        if (nextIndex === index) {
            return;
        }

        setDirection(nextIndex > index ? 'forward' : 'backward');
        setIndex(nextIndex);
    };

    useEffect(() => {
        const timer = setInterval(() => {
            setDirection('forward');
            setIndex((current) => (current + 1) % builderTips.length);
        }, ROTATE_INTERVAL);

        return () => clearInterval(timer);
    }, [index]);

    const tip = builderTips[index];

    return (
        <Root className={className}>
            <StyledImage src={brandPreviewImage} alt="" aria-hidden />
            <StyledShade aria-hidden />
            <StyledBrand>
                <StyledLogo src={sddsLogo} alt="" aria-hidden />
                <StyledBrandName>SDDS</StyledBrandName>
            </StyledBrand>
            <StyledCarousel>
                <StyledTip key={index} direction={direction}>
                    <StyledTopic>{tip.topic}</StyledTopic>
                    <StyledTitle>{tip.title}</StyledTitle>
                    <StyledDescription>{tip.description}</StyledDescription>
                </StyledTip>
                <StyledPagination>
                    {builderTips.map((item, itemIndex) => (
                        <StyledBullet
                            key={item.topic}
                            type="button"
                            active={itemIndex === index}
                            aria-label={item.topic}
                            aria-pressed={itemIndex === index}
                            onClick={() => goTo(itemIndex)}
                        />
                    ))}
                </StyledPagination>
            </StyledCarousel>
        </Root>
    );
};
