// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ChipToken
/// @notice Play-money ERC-20 for the Block Casino demo. No real value.
/// Anyone can claim free chips from the faucet. Only the casino can mint
/// beyond that, to cover payouts. There is no way to buy or sell chips.
contract ChipToken {
    string public constant name = "Block Casino Chips";
    string public constant symbol = "CHIP";
    uint8 public constant decimals = 18;

    uint256 public constant FAUCET_AMOUNT = 1_000e18;
    uint256 public constant FAUCET_COOLDOWN = 1 days;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => uint256) public lastFaucetAt;

    address public immutable owner;
    address public minter;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event MinterSet(address indexed minter);

    error NotOwner();
    error NotMinter();
    error MinterAlreadySet();
    error FaucetCooldown(uint256 availableAt);
    error InsufficientBalance();
    error InsufficientAllowance();

    constructor() {
        owner = msg.sender;
    }

    /// @notice One-time hookup of the casino as minter.
    function setMinter(address minter_) external {
        if (msg.sender != owner) revert NotOwner();
        if (minter != address(0)) revert MinterAlreadySet();
        minter = minter_;
        emit MinterSet(minter_);
    }

    function faucet() external {
        uint256 availableAt = lastFaucetAt[msg.sender] + FAUCET_COOLDOWN;
        if (lastFaucetAt[msg.sender] != 0 && block.timestamp < availableAt) {
            revert FaucetCooldown(availableAt);
        }
        lastFaucetAt[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != minter) revert NotMinter();
        _mint(to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < amount) revert InsufficientAllowance();
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        uint256 bal = balanceOf[from];
        if (bal < amount) revert InsufficientBalance();
        unchecked {
            balanceOf[from] = bal - amount;
        }
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }
}
