export default function isPhilippineNumber(number) {
    number = number.replace(/\s|-/g, "");

    return (
        number.startsWith("+63") ||
        number.startsWith("63") ||
        number.startsWith("09")
    );
}