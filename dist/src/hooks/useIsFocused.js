"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useIsFocused = useIsFocused;
const react_1 = require("react");
const expo_router_1 = require("expo-router");
/**
 * Whether this screen is the one currently on top of the stack. Expo Router keeps previous
 * stack screens mounted rather than unmounting them on navigation, so a screen's own
 * setInterval polling (e.g. celebration detection) keeps running in the background after you've
 * navigated away -- and since Modal in react-native-web portals straight to document.body, a
 * background screen's modal can pop up on top of whatever screen you're actually looking at.
 * Gate anything modal/full-screen on this so it only shows once you're actually back on it.
 */
function useIsFocused() {
    const [isFocused, setIsFocused] = (0, react_1.useState)(true);
    (0, expo_router_1.useFocusEffect)((0, react_1.useCallback)(() => {
        setIsFocused(true);
        return () => setIsFocused(false);
    }, []));
    return isFocused;
}
