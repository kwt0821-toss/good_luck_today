type SleepingLuckyCatProps = {
  className?: string;
};

export function SleepingLuckyCat({ className }: SleepingLuckyCatProps) {
  return (
    <div className={`lucky-cat-scene ${className ?? ""}`}>
      <div className="lucky-card-glow" aria-hidden="true" />
      <svg className="lucky-cat-svg" viewBox="0 0 360 460" fill="none" aria-hidden="true">
        <defs>
          <radialGradient id="luckyCardShade" cx="35%" cy="20%" r="80%">
            <stop offset="0%" stopColor="#5B8A7A" />
            <stop offset="100%" stopColor="#355C50" />
          </radialGradient>
          <pattern id="luckyPaws" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="8" cy="10" r="1.4" fill="#d7cbb3" opacity="0.22" />
            <circle cx="20" cy="22" r="1.1" fill="#d7cbb3" opacity="0.16" />
          </pattern>
        </defs>

        <g className="lucky-tail">
          <path
            d="M252 268 C 292 248 332 268 328 308 C 324 344 286 352 268 322 C 258 306 258 292 252 280"
            fill="#F7CD9F"
            stroke="#5C4038"
            strokeWidth="6"
            strokeLinejoin="round"
          />
          <path
            d="M286 276 C 300 288 304 308 294 322"
            stroke="#D4A06A"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </g>

        <g className="lucky-card">
          <rect x="88" y="138" width="184" height="286" rx="26" fill="url(#luckyCardShade)" />
          <rect
            x="88"
            y="138"
            width="184"
            height="286"
            rx="26"
            stroke="#F3EBD7"
            strokeWidth="8"
          />
          <rect
            x="102"
            y="152"
            width="156"
            height="258"
            rx="18"
            stroke="#E8DFC8"
            strokeWidth="1.6"
            opacity="0.75"
          />
          <rect x="102" y="152" width="156" height="258" rx="18" fill="url(#luckyPaws)" />
          <circle cx="180" cy="276" r="38" stroke="#E8DFC8" strokeWidth="1.4" opacity="0.7" />
          <circle cx="180" cy="276" r="28" fill="#F7F0E4" />
          <path d="M166 258 L162 244 L176 256" fill="#F7F0E4" stroke="#5C4038" strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M194 258 L198 244 L184 256" fill="#F7F0E4" stroke="#5C4038" strokeWidth="2.4" strokeLinejoin="round" />
          <circle cx="180" cy="280" r="18" fill="#F7F0E4" stroke="#5C4038" strokeWidth="2.4" />
          <circle cx="172" cy="282" r="3.2" fill="#F3A8A0" />
          <circle cx="188" cy="282" r="3.2" fill="#F3A8A0" />
          <path d="M172 274 Q176 277 180 274" stroke="#5C4038" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M180 274 Q184 277 188 274" stroke="#5C4038" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M176 288 Q180 292 184 288" stroke="#5C4038" strokeWidth="1.8" strokeLinecap="round" />
          <text
            x="180"
            y="334"
            textAnchor="middle"
            fill="#F3EBD7"
            fontSize="13"
            fontWeight="700"
            letterSpacing="1.6"
          >
            LUCKY CAT
          </text>
          <path d="M180 344 L183 349 L180 354 L177 349 Z" fill="#F3EBD7" />
          <text
            x="180"
            y="368"
            textAnchor="middle"
            fill="#D7CBB3"
            fontSize="8"
            letterSpacing="2.4"
          >
            FORTUNE CARD
          </text>
          <path d="M118 172 L121 178 L118 184 L115 178 Z" fill="#F3EBD7" opacity="0.8" />
          <path d="M236 390 L239 396 L236 402 L233 396 Z" fill="#F3EBD7" opacity="0.8" />
        </g>

        <g className="lucky-cat-breathe">
          <path
            d="M118 86 L110 32 L158 78 Z"
            fill="#F7CD9F"
            stroke="#5C4038"
            strokeWidth="5.5"
            strokeLinejoin="round"
          />
          <path
            d="M242 86 L250 32 L202 78 Z"
            fill="#F7CD9F"
            stroke="#5C4038"
            strokeWidth="5.5"
            strokeLinejoin="round"
          />
          <path d="M126 74 L122 44 L150 72 Z" fill="#F4B4AA" />
          <path d="M234 74 L238 44 L210 72 Z" fill="#F4B4AA" />
          <ellipse cx="180" cy="112" rx="82" ry="72" fill="#F7CD9F" stroke="#5C4038" strokeWidth="5.5" />
          <path d="M168 58 L166 88" stroke="#D4A06A" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M180 52 L180 86" stroke="#D4A06A" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M192 58 L194 88" stroke="#D4A06A" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M140 114 Q152 128 166 114" stroke="#5C4038" strokeWidth="5" strokeLinecap="round" />
          <path d="M194 114 Q208 128 220 114" stroke="#5C4038" strokeWidth="5" strokeLinecap="round" />
          <ellipse cx="140" cy="136" rx="15" ry="8" fill="#F3A8A0" />
          <ellipse cx="220" cy="136" rx="15" ry="8" fill="#F3A8A0" />
          <path d="M168 146 Q180 157 192 146" stroke="#5C4038" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="120" cy="176" rx="38" ry="23" fill="#F7CD9F" stroke="#5C4038" strokeWidth="5" />
          <ellipse cx="240" cy="176" rx="38" ry="23" fill="#F7CD9F" stroke="#5C4038" strokeWidth="5" />
          <circle cx="108" cy="176" r="3.8" fill="#E89A90" />
          <circle cx="120" cy="168" r="3.2" fill="#E89A90" />
          <circle cx="132" cy="176" r="3.8" fill="#E89A90" />
          <circle cx="228" cy="176" r="3.8" fill="#E89A90" />
          <circle cx="240" cy="168" r="3.2" fill="#E89A90" />
          <circle cx="252" cy="176" r="3.8" fill="#E89A90" />
        </g>
      </svg>

      <div className="lucky-zzz" aria-hidden="true">
        <span>z</span>
        <span>z</span>
        <span>z</span>
      </div>
    </div>
  );
}
