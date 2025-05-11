import { useEffect, useRef, useState } from 'react';

export function useDebouncedState<T>(defaultValue: T, delay: number) {
    const [value, setValue] = useState<T>(defaultValue);
    const [debouncedValue, setDebouncedValue] = useState<T>(defaultValue);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        timeoutRef.current = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [value, delay]);

    const reset = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setValue(defaultValue);
        setDebouncedValue(defaultValue);
    };

    const cancel = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        // rollback value to last committed debouncedValue
        setValue(debouncedValue);
    };

    return [value, debouncedValue, setValue, reset, cancel] as const;
};
