import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'dark' | 'light' | 'white-card'; // dark: 黒/暗背景用(ロゴ文字が白), light: 白背景用(ロゴ文字が黒), white-card: 白く丸みを帯びた背景カードの中に標準ロゴを包む
}

export default function Logo({ className = "h-10", variant = "light" }: LogoProps) {
  // 白背景カードの中にオリジナルカラーロゴを表示するスタイル
  if (variant === 'white-card') {
    return (
      <div className="bg-white px-3 py-1.5 rounded-xl shadow-sm border border-slate-200 inline-flex items-center justify-center">
        <svg 
          viewBox="0 0 400 120" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg" 
          className={`w-auto ${className}`}
        >
          {/* Catchphrase */}
          <text x="110" y="28" fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif" fontWeight="900" fontStyle="italic" fontSize="24" fill="#000000" letterSpacing="-0.5">Evolution of Shipping</text>
          
          {/* i Dots */}
          <polygon points="50,8 72,8 60,28 38,28" fill="#00A3FF"/>
          <polygon points="77,8 99,8 87,28 65,28" fill="#0066FF"/>
          
          {/* iKOUS text in Black */}
          <polygon points="34,36 62,36 38,112 10,112" fill="#000000"/>
          <polygon points="70,36 98,36 74,112 46,112" fill="#000000"/>
          <polygon points="126,36 156,36 108,74 86,74" fill="#000000"/>
          <polygon points="100,68 120,68 156,112 126,112" fill="#000000"/>
          
          {/* O */}
          <path d="M 152,36 L 222,36 L 196,112 L 126,112 Z M 172,56 L 158,92 L 178,92 L 192,56 Z" fill="#000000"/>
          <polygon points="196,36 222,36 216,48 190,48" fill="#00A84F"/>
          
          {/* U */}
          <path d="M 230,36 L 258,36 L 242,90 L 272,90 L 288,36 L 316,36 L 296,98 C 292,108 280,112 264,112 L 232,112 C 218,112 212,106 216,92 Z" fill="#000000"/>
          <polygon points="288,36 316,36 310,48 282,48" fill="#E50012"/>
          
          {/* S */}
          <path d="M 342,36 L 394,36 L 388,54 L 348,54 L 344,66 L 382,66 C 396,66 400,74 395,88 L 388,112 C 388,112 322,112 322,112 L 328,94 L 366,94 L 370,82 L 336,82 C 322,82 320,72 324,58 Z" fill="#000000"/>
          <polygon points="366,36 394,36 388,48 360,48" fill="#FF8300"/>
        </svg>
      </div>
    );
  }

  const textFill = variant === 'dark' ? '#FFFFFF' : '#000000';

  return (
    <svg 
      viewBox="0 0 400 120" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={`w-auto ${className}`}
    >
      {/* Catchphrase */}
      <text x="110" y="28" fontFamily="'Arial Black', 'Helvetica Neue', Arial, sans-serif" fontWeight="900" fontStyle="italic" fontSize="24" fill={textFill} letterSpacing="-0.5">Evolution of Shipping</text>
      
      {/* i Dots */}
      <polygon points="50,8 72,8 60,28 38,28" fill="#00A3FF"/>
      <polygon points="77,8 99,8 87,28 65,28" fill="#0066FF"/>
      
      {/* iKOUS text */}
      <polygon points="34,36 62,36 38,112 10,112" fill={textFill}/>
      <polygon points="70,36 98,36 74,112 46,112" fill={textFill}/>
      <polygon points="126,36 156,36 108,74 86,74" fill={textFill}/>
      <polygon points="100,68 120,68 156,112 126,112" fill={textFill}/>
      
      {/* O */}
      <path d="M 152,36 L 222,36 L 196,112 L 126,112 Z M 172,56 L 158,92 L 178,92 L 192,56 Z" fill={textFill}/>
      <polygon points="196,36 222,36 216,48 190,48" fill="#00A84F"/>
      
      {/* U */}
      <path d="M 230,36 L 258,36 L 242,90 L 272,90 L 288,36 L 316,36 L 296,98 C 292,108 280,112 264,112 L 232,112 C 218,112 212,106 216,92 Z" fill={textFill}/>
      <polygon points="288,36 316,36 310,48 282,48" fill="#E50012"/>
      
      {/* S */}
      <path d="M 342,36 L 394,36 L 388,54 L 348,54 L 344,66 L 382,66 C 396,66 400,74 395,88 L 388,112 C 388,112 322,112 322,112 L 328,94 L 366,94 L 370,82 L 336,82 C 322,82 320,72 324,58 Z" fill={textFill}/>
      <polygon points="366,36 394,36 388,48 360,48" fill="#FF8300"/>
    </svg>
  );
}
