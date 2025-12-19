import { type ReactNode } from 'react';
import { X } from 'lucide-react';

interface TrendModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
}

export const TrendModal = ({ isOpen, onClose, children }: TrendModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-7xl mx-4 max-h-[90vh] overflow-hidden">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <X className="w-5 h-5 text-gray-500" />
                </button>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[90vh]">
                    {children}
                </div>
            </div>
        </div>
    );
};
