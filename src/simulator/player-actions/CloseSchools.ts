import { ContainmentPolicy } from './PlayerActions';

export const CloseSchools: ContainmentPolicy = {
    id: 'schools',
    name: 'Schools',
    icon: 'fa-graduation-cap',
    requirements: [],
    activeLabel: 'Closed',
    inactiveLabel: 'Open',
    immediateEffect: (context) => context.indicators,
    recurringEffect: (context) => {
        const updatedWorldState = { ...context.indicators };
        updatedWorldState.r = Math.max(updatedWorldState.r - 0.03, 0);
        return updatedWorldState;
    }
};
