import AsyncStorage from '@react-native-community/async-storage';

import call from '../Call';
import Data from '../Data';
import {hashPassword} from '../../lib/utils';

const TOKEN_KEY = 'reactnativemeteor_usertoken';

module.exports = {
  user() {
    if (!this._userIdSaved) return null;

    return this.collection('users').findOne(this._userIdSaved);
  },
  userId() {
    if (!this._userIdSaved) return null;

    const user = this.collection('users').findOne(this._userIdSaved);
    return user && user._id;
  },
  _isLoggingIn: true,
  loggingIn() {
    return this._isLoggingIn;
  },
  logout() {
    return new Promise((resolve, reject) => {
      call('logout', error => {
        if (error) {
          reject(error);
        } else {
          this.handleLogout();
          this.connect();

          Data.notify('onLogout');

          resolve();
        }
      });
    });
  },
  handleLogout() {
    AsyncStorage.removeItem(TOKEN_KEY);
    Data._tokenIdSaved = null;
    this._userIdSaved = null;
  },
  loginWithPassword(selector, password) {
    if (typeof selector === 'string') {
      if (selector.indexOf('@') === -1) {
        selector = {username: selector};
      } else {
        selector = {email: selector};
      }
    }

    this._startLoggingIn();

    return new Promise((resolve, reject) => {
      const params = {
        user: selector,
        password: hashPassword(password),
      };

      call('login', params, (error, result) => {
        this._endLoggingIn();
        this._handleLoginCallback(error, result);

        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  },
  logoutOtherClients(callback = () => {}) {
    call('getNewToken', (err, res) => {
      if (err) return callback(err);

      this._handleLoginCallback(err, res);

      call('removeOtherTokens', err => {
        callback(err);
      });
    });
  },
  _login(user, callback) {
    this._startLoggingIn();
    this.call('login', user, (err, result) => {
      this._endLoggingIn();

      this._handleLoginCallback(err, result);

      typeof callback == 'function' && callback(err);
    });
  },
  _startLoggingIn() {
    this._isLoggingIn = true;
    Data.notify('loggingIn');
  },
  _endLoggingIn() {
    this._isLoggingIn = false;
    Data.notify('loggingIn');
  },
  _handleLoginCallback(err, result) {
    if (!err) {
      //save user id and token
      AsyncStorage.setItem(TOKEN_KEY, result.token);
      Data._tokenIdSaved = result.token;
      this._userIdSaved = result.id;
      Data.notify('onLogin');
    } else {
      Data.notify('onLoginFailure');
      this.handleLogout();
    }
    Data.notify('change');
  },
  _loginWithToken(value) {
    Data._tokenIdSaved = value;
    if (value !== null) {
      this._startLoggingIn();
      call('login', {resume: value}, (err, result) => {
        this._endLoggingIn();
        this._handleLoginCallback(err, result);
      });
    } else {
      this._endLoggingIn();
    }
  },
  getAuthToken() {
    return Data._tokenIdSaved;
  },
  async _loadInitialUser() {
    let value = null;

    try {
      value = await AsyncStorage.getItem(TOKEN_KEY);
    } catch (error) {
      console.warn('AsyncStorage error: ' + error.message);
    } finally {
      this._loginWithToken(value);
    }
  },
};
