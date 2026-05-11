interface OpenRiskLogoProps {
    size?: number;
    textSizeClassName?: string;
    className?: string;
}

export function OpenRiskLogo({
    size = 90,
    textSizeClassName = "text-4xl",
    className,
}: OpenRiskLogoProps) {
    return (
        <div className={`flex items-center gap-4 ${className ?? ""}`.trim()}>
            <div style={{ width: size, height: size }} className="text-current">
                <svg
                    className="h-full w-full"
                    viewBox="0 0 90 90"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                >
                    <path
                        d="M41.25 82.5C26.9775 77.0625 15 67.6275 15 48.75V22.5C15 21.5054 15.3951 20.5516 16.0984 19.8483C16.8016 19.1451 17.7554 18.75 18.75 18.75C26.25 18.75 35.625 14.25 42.15 8.54998C42.9445 7.87122 43.9551 7.49829 45 7.49829C46.0449 7.49829 47.0555 7.87122 47.85 8.54998C54.4125 14.2875 63.75 18.75 71.25 18.75C72.2446 18.75 73.1984 19.1451 73.9017 19.8483C74.6049 20.5516 75 21.5054 75 22.5V37.5"
                        stroke="currentColor"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M62.625 77.625C70.9093 77.625 77.625 70.9093 77.625 62.625C77.625 54.3407 70.9093 47.625 62.625 47.625C54.3407 47.625 47.625 54.3407 47.625 62.625C47.625 70.9093 54.3407 77.625 62.625 77.625Z"
                        stroke="currentColor"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <path
                        d="M81.375 81.375L73.3125 73.3125"
                        stroke="currentColor"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </div>
            <div className={`font-mozilla-headline tracking-tight ${textSizeClassName}`}>
                OpenRisk
            </div>
        </div>
    );
}
