// Scrollable.js
import React, { useRef, useState, useEffect } from 'react';

export default function Scrollable({ children, className = '' }) {
    const box = useRef(null);

    // 影を出す／消すフラグ
    const [shadow, setShadow] = useState({
        top: false,
        bottom: false,
        left: false,
        right: false,
    });

    // スクロール位置から影の有無を計算
    const updateShadow = () => {
        const el = box.current;
        if (!el) return;
        setShadow({
            top: el.scrollTop > 0,
            bottom: el.scrollTop + el.clientHeight < el.scrollHeight,
            left: el.scrollLeft > 0,
            right: el.scrollLeft + el.clientWidth < el.scrollWidth,
        });
    };

    // 初期化 + リスナー登録
    useEffect(() => {
        updateShadow();
        const el = box.current;
        if (!el) return;
        el.addEventListener('scroll', updateShadow, { passive: true });
        window.addEventListener('resize', updateShadow);
        return () => {
            el.removeEventListener('scroll', updateShadow);
            window.removeEventListener('resize', updateShadow);
        };
    }, []);

    return (
        <div className={`scroll-wrapper ${className}`}>
            {shadow.top && <div className="fade fade-top" />}
            {shadow.bottom && <div className="fade fade-bottom" />}
            {shadow.left && <div className="fade fade-left" />}
            {shadow.right && <div className="fade fade-right" />}

            {/* 実際にスクロールする要素 */}
            <div className="scroll-box" ref={box}>
                {children}
            </div>
        </div>
    );
}