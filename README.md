# SplatterJS

## Description

Spotify bot for farming streams using NodeJS and selenium webdriver. This project is intended for educational purposes only. I am not responsible for any misuse of this project. Please use this project at your own risk.

## Setup

1. Clone the repository
```bash
git clone https://github.com/shie1/splatterjs
```

2. Install dependencies
```bash
yarn install
```

3. Set the following environment variables
```bash
USERS=user1:password1;user2:password2
TARGET=target_value
```
The `USERS` variable should contain user credentials separated by a colon, and multiple users should be separated by a semicolon.
The `TARGET` variable should contain a playable spotify url.

4. Run the project
```bash
yarn start
```

## Development

To run the project in development mode, run the following command:
```bash
yarn dev
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)

## Contact

For any inquiries, please open an issue on the GitHub repository.